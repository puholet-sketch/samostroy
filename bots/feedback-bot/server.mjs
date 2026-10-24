/**
 * СамоСтрой Feedback API + Telegram notify.
 * JSON-файл по умолчанию; Postgres при DATABASE_URL (Docker).
 * Контракт совместим с будущим Supabase-бэкендом.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Busboy from 'busboy'
import { createStore } from './store.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv(path.join(__dirname, '.env'))

const DATA_DIR = path.join(__dirname, 'data')
const IMG_DIR = process.env.FEEDBACK_IMAGES_DIR
  ? path.resolve(process.env.FEEDBACK_IMAGES_DIR)
  : path.join(DATA_DIR, 'images')
const DB_FILE = path.join(DATA_DIR, 'feedback.json')

const PORT = Number(process.env.PORT || 8787)
const TOKEN = process.env.FEEDBACK_TOKEN || ''
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || ''

fs.mkdirSync(IMG_DIR, { recursive: true })

const store = createStore({ dataDir: DATA_DIR, imgDir: IMG_DIR, dbFile: DB_FILE })

function auth(req) {
  const h = req.headers['x-feedback-token']
  if (!TOKEN) return false
  return h === TOKEN
}

function sendJson(res, code, body) {
  const data = JSON.stringify(body)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Feedback-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  })
  res.end(data)
}

function cors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Feedback-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  })
  res.end()
}

async function tg(method, payload) {
  if (!TG_TOKEN) return null
  const url = `https://api.telegram.org/bot${TG_TOKEN}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    console.error('tg', method, res.status, await res.text())
    return null
  }
  return res.json()
}

async function tgSendPhoto(item, imagePath) {
  if (!TG_TOKEN || !TG_CHAT) return null
  const caption = [
    `📝 ${item.title}`,
    `Id: ${item.id}`,
    `Тип: ${item.kind} · ${item.status}`,
    `Автор: ${item.authorName} (${item.authorRole})`,
    `Страница: ${item.pageTitle}`,
    `Route: ${item.route}`,
    `Сборка: ${item.buildStamp}`,
    item.body ? `\n${item.body.slice(0, 800)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000)

  const buf = fs.readFileSync(imagePath)
  const form = new FormData()
  form.append('chat_id', TG_CHAT)
  form.append('caption', caption)
  form.append('photo', new Blob([buf], { type: 'image/png' }), `${item.id}.png`)
  form.append(
    'reply_markup',
    JSON.stringify({
      inline_keyboard: [
        [
          { text: 'В работу', callback_data: `fb:in_progress:${item.id}` },
          { text: 'Сделано', callback_data: `fb:done:${item.id}` },
        ],
      ],
    }),
  )

  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    console.error('sendPhoto', res.status, await res.text())
    return null
  }
  const data = await res.json()
  return data?.result?.message_id ?? null
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers })
    let meta = null
    let imageBuf = null
    let imageName = 'shot.png'
    bb.on('file', (name, file, info) => {
      const chunks = []
      if (info.filename) imageName = info.filename
      file.on('data', (d) => chunks.push(d))
      file.on('end', () => {
        if (name === 'image') imageBuf = Buffer.concat(chunks)
      })
    })
    bb.on('field', (name, val) => {
      if (name === 'meta') {
        try {
          meta = JSON.parse(val)
        } catch (e) {
          reject(e)
        }
      }
    })
    bb.on('error', reject)
    bb.on('finish', () => resolve({ meta, imageBuf, imageName }))
    req.pipe(bb)
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return cors(res)

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    if (pathname === '/health') {
      return sendJson(res, 200, { ok: true, store: store.mode })
    }

    if (pathname === '/telegram/webhook' && req.method === 'POST') {
      const raw = await readBody(req)
      const update = JSON.parse(raw.toString('utf8') || '{}')
      const cb = update.callback_query
      if (cb?.data?.startsWith('fb:')) {
        const [, status, id] = cb.data.split(':')
        if (status === 'in_progress' || status === 'done' || status === 'new') {
          const updated = await store.updateStatus(id, status)
          if (updated) {
            await tg('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: status === 'done' ? 'Сделано' : 'В работе',
            })
            if (cb.message?.message_id) {
              await tg('editMessageReplyMarkup', {
                chat_id: cb.message.chat.id,
                message_id: cb.message.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: `Статус: ${status}`, callback_data: `fb:noop:${id}` }],
                  ],
                },
              })
            }
          } else {
            await tg('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: 'Не найдено',
            })
          }
        }
      }
      return sendJson(res, 200, { ok: true })
    }

    if (!auth(req) && pathname.startsWith('/api/')) {
      return sendJson(res, 401, { error: 'unauthorized' })
    }

    if (pathname === '/api/feedback' && req.method === 'GET') {
      return sendJson(res, 200, await store.list())
    }

    if (pathname === '/api/feedback' && req.method === 'POST') {
      const { meta, imageBuf } = await parseMultipart(req)
      if (!meta?.id || !imageBuf) {
        return sendJson(res, 400, { error: 'meta+image required' })
      }
      const draft = {
        ...meta,
        status: meta.status || 'new',
        syncStatus: 'synced',
        imageId: meta.imageId || `fbimg-${meta.id}`,
      }
      const imgPath = store.imagePath(meta.id)
      fs.writeFileSync(imgPath, imageBuf)
      const tgMessageId = await tgSendPhoto(draft, imgPath)
      if (tgMessageId) draft.tgMessageId = tgMessageId
      const item = await store.upsert(draft, null)
      return sendJson(res, 201, { id: item.id, tgMessageId: item.tgMessageId })
    }

    const one = pathname.match(/^\/api\/feedback\/([^/]+)(?:\/(image))?$/)
    if (one) {
      const id = decodeURIComponent(one[1])
      const wantImage = one[2] === 'image'
      const item = await store.get(id)
      if (!item) return sendJson(res, 404, { error: 'not found' })

      if (wantImage && req.method === 'GET') {
        const imgPath = store.imagePath(id)
        if (!fs.existsSync(imgPath)) return sendJson(res, 404, { error: 'no image' })
        const buf = fs.readFileSync(imgPath)
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'private, max-age=60',
        })
        return res.end(buf)
      }

      if (req.method === 'GET') {
        return sendJson(res, 200, item)
      }

      if (req.method === 'PATCH') {
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf8') || '{}')
        if (!body.status) return sendJson(res, 400, { error: 'status required' })
        const updated = await store.updateStatus(id, body.status)
        if (!updated) return sendJson(res, 404, { error: 'not found' })
        return sendJson(res, 200, updated)
      }
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: String(e?.message || e) })
  }
})

await store.ready().catch((e) => {
  console.error('store ready failed', e)
  process.exit(1)
})

server.listen(PORT, () => {
  console.log(`feedback-bot on :${PORT} (store=${store.mode})`)
  if (!TOKEN) console.warn('WARN: FEEDBACK_TOKEN empty')
  if (!TG_TOKEN) console.warn('WARN: TELEGRAM_BOT_TOKEN empty — notify disabled')
})

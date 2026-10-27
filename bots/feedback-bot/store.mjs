/**
 * Хранилище: Postgres при DATABASE_URL, иначе JSON-файлы.
 * Feedback + object daily reports + control links.
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

export function createStore({ dataDir, imgDir, dbFile }) {
  const databaseUrl = process.env.DATABASE_URL || ''
  if (databaseUrl) {
    return createPgStore(databaseUrl, imgDir)
  }
  return createJsonStore(dataDir, imgDir, dbFile)
}

function rowToItem(row) {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    title: row.title,
    body: row.body ?? '',
    kind: row.kind,
    status: row.status,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    route: row.route ?? '',
    pageTitle: row.page_title ?? '',
    buildStamp: row.build_stamp ?? '',
    markers: row.markers ?? [],
    imageId: row.image_id,
    tgMessageId: row.tg_message_id ?? undefined,
    syncStatus: row.sync_status ?? 'synced',
    syncError: row.sync_error ?? undefined,
  }
}

function rowToReport(row) {
  return {
    id: row.id,
    token: row.token,
    date: toDateOnly(row.report_date),
    workDone: row.work_done ?? '',
    problems: row.problems ?? '',
    workerName: row.worker_name ?? '',
    media: Array.isArray(row.media) ? row.media : row.media ?? [],
    createdAt: toIso(row.created_at),
  }
}

function rowToLink(row) {
  return {
    token: row.token,
    clientId: row.client_id ?? '',
    objectId: row.object_id ?? '',
    objectTitle: row.object_title ?? '',
    objectAddress: row.object_address ?? '',
  }
}

function toIso(v) {
  if (!v) return new Date().toISOString()
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function toDateOnly(v) {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function createPgStore(databaseUrl, imgDir) {
  const pool = new pg.Pool({ connectionString: databaseUrl })

  return {
    mode: 'postgres',
    async ready() {
      await pool.query('select 1')
    },
    async list() {
      const { rows } = await pool.query(
        'select * from feedback_items order by created_at desc',
      )
      return rows.map(rowToItem)
    },
    async get(id) {
      const { rows } = await pool.query(
        'select * from feedback_items where id = $1',
        [id],
      )
      return rows[0] ? rowToItem(rows[0]) : null
    },
    async upsert(item, imageBuf) {
      const imgPath = path.join(imgDir, `${item.id}.png`)
      if (imageBuf) fs.writeFileSync(imgPath, imageBuf)
      const now = new Date().toISOString()
      const createdAt = item.createdAt || now
      const markers = JSON.stringify(item.markers ?? [])
      await pool.query(
        `insert into feedback_items (
          id, created_at, updated_at, title, body, kind, status,
          author_id, author_name, author_role, route, page_title, build_stamp,
          markers, image_id, image_path, tg_message_id, sync_status, sync_error
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19
        )
        on conflict (id) do update set
          updated_at = excluded.updated_at,
          title = excluded.title,
          body = excluded.body,
          kind = excluded.kind,
          status = excluded.status,
          author_id = excluded.author_id,
          author_name = excluded.author_name,
          author_role = excluded.author_role,
          route = excluded.route,
          page_title = excluded.page_title,
          build_stamp = excluded.build_stamp,
          markers = excluded.markers,
          image_id = excluded.image_id,
          image_path = excluded.image_path,
          tg_message_id = coalesce(excluded.tg_message_id, feedback_items.tg_message_id),
          sync_status = excluded.sync_status,
          sync_error = excluded.sync_error
        `,
        [
          item.id,
          createdAt,
          now,
          item.title,
          item.body ?? '',
          item.kind,
          item.status ?? 'new',
          item.authorId,
          item.authorName,
          item.authorRole,
          item.route ?? '',
          item.pageTitle ?? '',
          item.buildStamp ?? '',
          markers,
          item.imageId || `fbimg-${item.id}`,
          imgPath,
          item.tgMessageId ?? null,
          item.syncStatus ?? 'synced',
          item.syncError ?? null,
        ],
      )
      return {
        ...item,
        createdAt,
        updatedAt: now,
        imageId: item.imageId || `fbimg-${item.id}`,
        syncStatus: 'synced',
      }
    },
    async updateStatus(id, status) {
      const { rows } = await pool.query(
        `update feedback_items
         set status = $2, updated_at = now()
         where id = $1
         returning *`,
        [id, status],
      )
      return rows[0] ? rowToItem(rows[0]) : null
    },
    imagePath(id) {
      return path.join(imgDir, `${id}.png`)
    },

    async listObjectReports(token) {
      if (token) {
        const { rows } = await pool.query(
          'select * from object_reports where token = $1 order by report_date desc',
          [token],
        )
        return rows.map(rowToReport)
      }
      const { rows } = await pool.query(
        'select * from object_reports order by report_date desc limit 500',
      )
      return rows.map(rowToReport)
    },
    async upsertObjectReport(report) {
      const now = new Date().toISOString()
      const media = JSON.stringify(report.media ?? [])
      const createdAt = report.createdAt || now
      const { rows } = await pool.query(
        `insert into object_reports (
          id, token, report_date, work_done, problems, worker_name, media, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        on conflict (token, report_date) do update set
          work_done = excluded.work_done,
          problems = excluded.problems,
          worker_name = excluded.worker_name,
          media = excluded.media,
          updated_at = excluded.updated_at
        returning *
        `,
        [
          report.id,
          report.token,
          report.date,
          report.workDone ?? '',
          report.problems ?? '',
          report.workerName ?? '',
          media,
          createdAt,
          now,
        ],
      )
      return rows[0] ? rowToReport(rows[0]) : { ...report, createdAt, media: report.media ?? [] }
    },
    async getControlLink(token) {
      const { rows } = await pool.query(
        'select * from control_links where token = $1',
        [token],
      )
      return rows[0] ? rowToLink(rows[0]) : null
    },
    async upsertControlLink(link) {
      const now = new Date().toISOString()
      await pool.query(
        `insert into control_links (
          token, client_id, object_id, object_title, object_address, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7)
        on conflict (token) do update set
          client_id = excluded.client_id,
          object_id = excluded.object_id,
          object_title = excluded.object_title,
          object_address = excluded.object_address,
          updated_at = excluded.updated_at
        `,
        [
          link.token,
          link.clientId ?? '',
          link.objectId ?? '',
          link.objectTitle ?? '',
          link.objectAddress ?? '',
          now,
          now,
        ],
      )
      return link
    },

    async close() {
      await pool.end()
    },
  }
}

function createJsonStore(dataDir, imgDir, dbFile) {
  fs.mkdirSync(imgDir, { recursive: true })
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]')
  const reportsFile = path.join(dataDir, 'object_reports.json')
  const linksFile = path.join(dataDir, 'control_links.json')
  if (!fs.existsSync(reportsFile)) fs.writeFileSync(reportsFile, '[]')
  if (!fs.existsSync(linksFile)) fs.writeFileSync(linksFile, '[]')

  function readJson(file) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  }

  function writeJson(file, list) {
    fs.writeFileSync(file, JSON.stringify(list, null, 2))
  }

  function readDb() {
    return readJson(dbFile)
  }

  function writeDb(list) {
    writeJson(dbFile, list)
  }

  return {
    mode: 'json',
    async ready() {},
    async list() {
      return readDb()
    },
    async get(id) {
      return readDb().find((x) => x.id === id) ?? null
    },
    async upsert(item, imageBuf) {
      const imgPath = path.join(imgDir, `${item.id}.png`)
      if (imageBuf) fs.writeFileSync(imgPath, imageBuf)
      const now = new Date().toISOString()
      const next = {
        ...item,
        createdAt: item.createdAt || now,
        updatedAt: now,
        syncStatus: 'synced',
        imageId: item.imageId || `fbimg-${item.id}`,
      }
      const list = readDb().filter((x) => x.id !== next.id)
      list.unshift(next)
      writeDb(list)
      return next
    },
    async updateStatus(id, status) {
      const list = readDb()
      const i = list.findIndex((x) => x.id === id)
      if (i < 0) return null
      list[i] = { ...list[i], status, updatedAt: new Date().toISOString() }
      writeDb(list)
      return list[i]
    },
    imagePath(id) {
      return path.join(imgDir, `${id}.png`)
    },

    async listObjectReports(token) {
      const list = readJson(reportsFile)
      if (token) return list.filter((r) => r.token === token)
      return list
    },
    async upsertObjectReport(report) {
      const list = readJson(reportsFile)
      const now = new Date().toISOString()
      const next = {
        ...report,
        media: report.media ?? [],
        createdAt: report.createdAt || now,
      }
      const idx = list.findIndex((r) => r.token === next.token && r.date === next.date)
      if (idx >= 0) {
        next.id = list[idx].id
        list[idx] = next
      } else {
        list.unshift(next)
      }
      writeJson(reportsFile, list)
      return next
    },
    async getControlLink(token) {
      return readJson(linksFile).find((l) => l.token === token) ?? null
    },
    async upsertControlLink(link) {
      const list = readJson(linksFile)
      const idx = list.findIndex((l) => l.token === link.token)
      if (idx >= 0) list[idx] = link
      else list.push(link)
      writeJson(linksFile, list)
      return link
    },

    async close() {},
  }
}

/**
 * Хранилище feedback: Postgres при DATABASE_URL, иначе JSON-файл.
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

function toIso(v) {
  if (!v) return new Date().toISOString()
  if (v instanceof Date) return v.toISOString()
  return String(v)
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
    async close() {
      await pool.end()
    },
  }
}

function createJsonStore(dataDir, imgDir, dbFile) {
  fs.mkdirSync(imgDir, { recursive: true })
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]')

  function readDb() {
    try {
      const raw = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  }

  function writeDb(list) {
    fs.writeFileSync(dbFile, JSON.stringify(list, null, 2))
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
    async close() {},
  }
}

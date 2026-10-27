import seedPublic from '../../data/clients_public.json'
import { phoneDigitsMatch } from './phoneActions'

export type ClientPersonType = 'fiz' | 'ur'

export type ClientObject = {
  id: string
  address: string
  title: string
  contractNumber: string
}

export const CHANNEL_OPTIONS = ['Соцсети', 'Маркетолог', 'Рекомендация', 'Сайт', 'Другое'] as const

export type ClientCard = {
  id: string
  fizurlico: ClientPersonType
  name: string
  email: string
  mobile: string
  mobile2: string
  manager: string
  designer: string
  picker: string
  prorab: string
  otk: string
  city: string
  tag: string
  source: string
  /** Канал привлечения: соцсети, маркетолог и т.д. */
  channel: string
  /** Ссылка на карточку/сделку в AmoCRM */
  amo_link: string
  objects_note: string
  /** Объекты клиента (адреса / договоры) */
  objects: ClientObject[]
  // passport
  dob: string
  pob: string
  type_passport: string
  passport_number: string
  passport_issued: string
  passport_date_issued: string
  passport_code: string
  address: string
  files_1: string
  files_2: string
  // legal
  lico: string
  osnovanie: string
  podpisant: string
  address_ur: string
  inn: string
  kpp: string
  bank: string
  bik: string
  rs: string
  ks: string
  // meta docs
  dogovor_design: string
  smeta: string
  dogovor_otdelka: string
  /** Момент создания (для сортировки «недавно добавленные») */
  createdAt: string
  updatedAt: string
}

export const emptyClient = (partial?: Partial<ClientCard>): ClientCard => ({
  id: `c${Date.now()}`,
  fizurlico: 'fiz',
  name: '',
  email: '',
  mobile: '',
  mobile2: '',
  manager: '',
  designer: '',
  picker: '',
  prorab: '',
  otk: '',
  city: 'Москва',
  tag: 'лид',
  source: '',
  channel: '',
  amo_link: '',
  objects_note: '',
  objects: [],
  dob: '',
  pob: '',
  type_passport: 'РФ',
  passport_number: '',
  passport_issued: '',
  passport_date_issued: '',
  passport_code: '',
  address: '',
  files_1: '',
  files_2: '',
  lico: '',
  osnovanie: '',
  podpisant: '',
  address_ur: '',
  inn: '',
  kpp: '',
  bank: '',
  bik: '',
  rs: '',
  ks: '',
  dogovor_design: '',
  smeta: '',
  dogovor_otdelka: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
})

/** Извлечь ISO createdAt: явного поле → timestamp из id `c…` → updatedAt → epoch */
export function inferClientCreatedAt(c: Partial<ClientCard> & { id?: string }): string {
  if (c.createdAt && !Number.isNaN(Date.parse(c.createdAt))) return c.createdAt
  const id = c.id || ''
  const m = /^c(\d{10,13})$/.exec(id)
  if (m) {
    const n = Number(m[1])
    if (n > 1e11) return new Date(n).toISOString()
    if (n > 1e9) return new Date(n * 1000).toISOString()
  }
  if (c.updatedAt && !Number.isNaN(Date.parse(c.updatedAt))) return c.updatedAt
  return new Date(0).toISOString()
}

/**
 * v4: localStorage с вашей локальной базой не перезаписываем извне.
 * В бандл/git идёт только анонимный clients_public.json.
 * Реальный CRM (clients_from_crm.json) подмешивается в dev через /api/local-crm-seed.
 */
const STORAGE_KEY = 'samostroy:client_cards_v4'

const publicRaw: unknown = Array.isArray(seedPublic)
  ? seedPublic
  : seedPublic && typeof seedPublic === 'object' && 'default' in (seedPublic as object)
    ? (seedPublic as unknown as { default: unknown }).default
    : seedPublic

const SEED: ClientCard[] = (Array.isArray(publicRaw) ? publicRaw : []).map((c) =>
  emptyClient({ ...(c as Partial<ClientCard>), id: (c as ClientCard).id || `demo-tmp` }),
)

function ensureObjects(c: ClientCard): ClientObject[] {
  if (Array.isArray(c.objects) && c.objects.length > 0) {
    return c.objects.map((o) => ({
      id: o.id || `obj-${Math.random().toString(36).slice(2, 8)}`,
      address: o.address || '',
      title: o.title || o.address || 'Объект',
      contractNumber: o.contractNumber || '',
    }))
  }
  // миграция: objects_note / address → один объект
  const addr = (c.objects_note || c.address || '').trim()
  if (!addr) return []
  return [
    {
      id: `obj-${c.id}-1`,
      address: addr,
      title: addr.length > 40 ? `${addr.slice(0, 40)}…` : addr,
      contractNumber: c.dogovor_otdelka || c.dogovor_design || '',
    },
  ]
}

function normalizeList(list: ClientCard[]): ClientCard[] {
  return list.map((c) => {
    const raw = c as ClientCard & {
      client_access_remont?: boolean
      client_access_design?: boolean
    }
    // убрать нерабочие portal-поля из локальной копии
    const { client_access_remont: _r, client_access_design: _d, ...rest } = raw
    void _r
    void _d
    const base = { ...emptyClient({ id: rest.id }), ...rest }
    const createdAt = inferClientCreatedAt(base)
    return {
      ...base,
      objects: ensureObjects(base),
      channel: base.channel || base.source || '',
      createdAt,
      updatedAt: base.updatedAt || createdAt,
      amo_link: base.amo_link || '',
    }
  })
}

/** Сортировка: недавно добавленные сверху */
export function sortClientsRecentFirst(list: ClientCard[]): ClientCard[] {
  return [...list].sort((a, b) => {
    const tb = Date.parse(inferClientCreatedAt(b)) || 0
    const ta = Date.parse(inferClientCreatedAt(a)) || 0
    if (tb !== ta) return tb - ta
    return (b.id || '').localeCompare(a.id || '')
  })
}

/** Поиск: ФИО / канал / адрес + любая непрерывная последовательность цифр телефона */
export function matchClientSearch(c: ClientCard, query: string): boolean {
  const s = query.trim().toLowerCase()
  if (!s) return true
  const digits = s.replace(/\D/g, '')
  const onlyDigits = digits.length > 0 && !/[a-zа-яё]/i.test(s)

  if (onlyDigits) {
    return phoneDigitsMatch(c.mobile, digits) || phoneDigitsMatch(c.mobile2, digits)
  }

  const textOk =
    c.name.toLowerCase().includes(s) ||
    c.city.toLowerCase().includes(s) ||
    c.channel.toLowerCase().includes(s) ||
    c.tag.toLowerCase().includes(s) ||
    c.manager.toLowerCase().includes(s) ||
    c.email.toLowerCase().includes(s) ||
    c.objects.some(
      (o) =>
        o.address.toLowerCase().includes(s) ||
        o.title.toLowerCase().includes(s) ||
        o.contractNumber.toLowerCase().includes(s),
    )

  if (digits.length >= 3) {
    const phoneOk =
      phoneDigitsMatch(c.mobile, digits) || phoneDigitsMatch(c.mobile2, digits)
    const namePart = s.replace(/[\d\s\-()+]+/g, ' ').trim()
    if (namePart) {
      return c.name.toLowerCase().includes(namePart) && phoneOk
    }
    return phoneOk
  }

  return textOk
}

/** Раздельный фильтр: ФИО + телефон (непрерывные цифры) + канал — все условия через И */
export function matchClientFilters(
  c: ClientCard,
  filters: { name?: string; phone?: string; channel?: string },
): boolean {
  const nameQ = (filters.name ?? '').trim().toLowerCase()
  const phoneQ = (filters.phone ?? '').replace(/\D/g, '')
  const channelQ = (filters.channel ?? '').trim().toLowerCase()

  if (nameQ && !c.name.toLowerCase().includes(nameQ)) return false

  if (phoneQ) {
    const ok =
      phoneDigitsMatch(c.mobile, phoneQ) || phoneDigitsMatch(c.mobile2, phoneQ)
    if (!ok) return false
  }

  if (channelQ && !c.channel.toLowerCase().includes(channelQ)) return false

  return true
}

export function deleteClient(id: string): ClientCard[] {
  const next = loadClients().filter((c) => c.id !== id)
  saveClients(next)
  return next
}

function readStoredClients(): ClientCard[] | null {
  try {
    for (const key of [STORAGE_KEY, 'samostroy:client_cards_v3', 'samostroy:client_cards_v2']) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const list = JSON.parse(raw) as ClientCard[]
      if (!Array.isArray(list)) continue
      // залипший пустой массив — вычищаем
      if (list.length === 0) {
        localStorage.removeItem(key)
        continue
      }
      const normalized = normalizeList(list)
      if (key !== STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      return normalized
    }
  } catch {
    /* ignore */
  }
  return null
}

export function loadClients(): ClientCard[] {
  return readStoredClients() ?? SEED
}

export function saveClients(list: ClientCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/** Dev: подтянуть локальный CRM, если в браузере ещё нет клиентов. */
export async function hydrateLocalCrmIfEmpty(): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  try {
    const existing = readStoredClients()
    if (existing && existing.length > 0) return false

    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const res = await fetch(`${base}/api/local-crm-seed`)
    if (!res.ok) return false
    const data = (await res.json()) as Partial<ClientCard>[]
    if (!Array.isArray(data) || data.length === 0) {
      // CRM недоступен — положим публичный сид, чтобы экран не был пустым
      if (SEED.length > 0) {
        saveClients(SEED)
        return true
      }
      return false
    }

    const normalized = normalizeList(
      data.map(
        (c) =>
          ({ ...c, id: c.id || `crm-${Math.random().toString(36).slice(2, 9)}` }) as ClientCard,
      ),
    )
    saveClients(normalized)
    return true
  } catch {
    if (SEED.length > 0) {
      saveClients(SEED)
      return true
    }
    return false
  }
}

export { telHref } from './phoneActions'

/** `mailto:` для почтового клиента */
export function mailHref(raw: string): string | null {
  const email = raw.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return `mailto:${email}`
}

import seedPublic from '../../data/clients_public.json'

export type ClientPersonType = 'fiz' | 'ur'

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
  amo_link: string
  client_access_remont: boolean
  client_access_design: boolean
  objects_note: string
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
  amo_link: '',
  client_access_remont: false,
  client_access_design: false,
  objects_note: '',
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
  updatedAt: new Date().toISOString(),
  ...partial,
})

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

function normalizeList(list: ClientCard[]): ClientCard[] {
  return list.map((c) => ({ ...emptyClient({ id: c.id }), ...c }))
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

/** `tel:` для нативной звонилки (Android / iOS) */
export function telHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/[^\d+]/g, '')
  const normalized = digits.startsWith('+')
    ? `+${digits.slice(1).replace(/\D/g, '')}`
    : digits.replace(/\D/g, '')
  return normalized.length >= 5 ? `tel:${normalized}` : null
}

/** `mailto:` для почтового клиента */
export function mailHref(raw: string): string | null {
  const email = raw.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return `mailto:${email}`
}

import seedFromCrm from '../../data/clients_from_crm.json'

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

/** v3 — без демо Иванов/Северстрой; CRM-сид только в dev (не в публичный prod-бандл) */
const STORAGE_KEY = 'samostroy:client_cards_v3'

const SEED: ClientCard[] = import.meta.env.DEV
  ? (Array.isArray(seedFromCrm) ? seedFromCrm : []).map((c) =>
      emptyClient({ ...(c as Partial<ClientCard>), id: (c as ClientCard).id || `crm-tmp` }),
    )
  : []

export function loadClients(): ClientCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const list = JSON.parse(raw) as ClientCard[]
      return list.map((c) => ({ ...emptyClient({ id: c.id }), ...c }))
    }
  } catch {
    /* ignore */
  }
  return SEED
}

export function saveClients(list: ClientCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
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

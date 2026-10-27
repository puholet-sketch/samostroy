/**
 * Строит публичный анонимизированный сид из локального CRM-импорта.
 * Локальный data/clients_from_crm.json не меняет.
 *
 * node docs/scripts/anonymize_clients.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcPath = join(root, 'data/clients_from_crm.json')
const outPath = join(root, 'data/clients_public.json')

const LAST = [
  'Иванов',
  'Петров',
  'Сидоров',
  'Козлов',
  'Новиков',
  'Морозов',
  'Волков',
  'Алексеев',
  'Лебедев',
  'Семёнов',
  'Егоров',
  'Павлов',
  'Козлова',
  'Новикова',
  'Морозова',
  'Волкова',
]
const FIRST_M = ['Алексей', 'Дмитрий', 'Сергей', 'Андрей', 'Игорь', 'Павел', 'Николай', 'Максим']
const FIRST_F = ['Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Ирина', 'Татьяна', 'Екатерина']
const PATR_M = ['Александрович', 'Сергеевич', 'Иванович', 'Петрович', 'Дмитриевич', 'Андреевич']
const PATR_F = ['Александровна', 'Сергеевна', 'Ивановна', 'Петровна', 'Дмитриевна', 'Андреевна']
const CITIES = ['Москва', 'Химки', 'Мытищи', 'Подольск', 'Королёв', 'Балашиха']
const STREETS = ['ул. Примерная', 'ул. Садовая', 'пр-т Мира', 'ул. Ленина', 'ул. Центральная']

function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

function fakeFio(i, ur) {
  if (ur) return `ООО «ДемоСтрой-${i + 1}»`
  const female = i % 2 === 0
  const last = LAST[i % LAST.length]
  const first = (female ? FIRST_F : FIRST_M)[i % 8]
  const patr = (female ? PATR_F : PATR_M)[i % 6]
  return `${last} ${first} ${patr}`
}

function shortFio(full) {
  const p = full.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 3) return `${p[0]} ${p[1][0]}.${p[2][0]}.`
  return full
}

function anonStatus(text, i) {
  if (!text || !String(text).trim()) return ''
  const status = String(text).replace(/№\s*\d+/g, '').trim()
  const num = 1000 + (i % 800)
  return status ? `№${num} ${status}`.trim() : `№${num}`
}

function anonymize(row, i) {
  const ur = row.fizurlico === 'ur' || /^ООО|ИП |АО /i.test(row.name || '')
  const name = fakeFio(i, ur)
  const city = CITIES[i % CITIES.length]
  const street = STREETS[i % STREETS.length]
  const flat = 10 + (i % 90)
  const address = `г. ${city}, ${street}, д. ${1 + (i % 40)}, кв. ${flat}`
  const series = 4500 + (i % 50)
  const number = 100000 + ((i * 7919) % 800000)

  return {
    id: `demo-${i + 1}`,
    fizurlico: ur ? 'ur' : 'fiz',
    name,
    email: `client${i + 1}@example.com`,
    mobile: `+7903${pad(1000000 + i, 7).slice(-7)}`,
    mobile2: '',
    manager: row.manager ? 'Менеджер демо' : '',
    designer: row.designer ? 'Дизайнер демо' : '',
    picker: row.picker ? 'Комплектатор демо' : '',
    prorab: row.prorab ? 'Прораб демо' : '',
    otk: row.otk && !/не заполнено/i.test(row.otk) ? 'ОТК демо' : '',
    city,
    tag: row.tag || 'договор',
    source: 'демо',
    amo_link: '',
    objects_note: address,
    dob: `${pad(1 + (i % 28))}/${pad(1 + (i % 12))}/${1970 + (i % 25)}`,
    pob: `г. ${city}`,
    type_passport: 'РФ',
    passport_number: `${series} ${number}`,
    passport_issued: `ОВД г. ${city}`,
    passport_date_issued: `${pad(1 + (i % 28))}/${pad(1 + (i % 12))}/${2005 + (i % 15)}`,
    passport_code: `${770 + (i % 20)}-${pad(i % 100)}`,
    address,
    files_1: '',
    files_2: '',
    lico: ur ? 'Генеральный директор' : '',
    osnovanie: ur ? 'Устав' : '',
    podpisant: ur ? shortFio(name.replace(/^ООО «|»$/g, 'Иванов')) : '',
    address_ur: ur ? address : '',
    inn: ur ? `7701${pad(100000 + i, 6)}` : '',
    kpp: ur ? '770101001' : '',
    bank: ur ? 'АО «Демо Банк»' : '',
    bik: ur ? '044525225' : '',
    rs: ur ? `40702810${pad(100000000 + i, 11).slice(-11)}` : '',
    ks: ur ? '30101810400000000225' : '',
    dogovor_design: anonStatus(row.dogovor_design, i * 3),
    smeta: anonStatus(row.smeta, i * 3 + 1),
    dogovor_otdelka: anonStatus(row.dogovor_otdelka, i * 3 + 2),
    updatedAt: new Date().toISOString(),
  }
}

if (!existsSync(srcPath)) {
  console.error('Нет локального файла:', srcPath)
  console.error('Сначала импортируйте CRM или положите clients_from_crm.json')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(srcPath, 'utf8'))
if (!Array.isArray(raw) || raw.length === 0) {
  console.error('CRM-файл пуст')
  process.exit(1)
}

const out = raw.map((row, i) => anonymize(row, i))
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
console.log(`OK: ${out.length} → ${outPath}`)
console.log('Локальный clients_from_crm.json не изменён')

const ONES = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
]
const ONES_F = [
  '',
  'одна',
  'две',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
]
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
]
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
]
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
]

function triad(n: number, female: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const o = n % 10
  const parts: string[] = []
  if (h) parts.push(HUNDREDS[h])
  if (t === 1) {
    parts.push(TEENS[o])
  } else {
    if (t) parts.push(TENS[t])
    if (o) parts.push((female ? ONES_F : ONES)[o])
  }
  return parts.join(' ')
}

function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few
  return many
}

/** «два миллиона сто тысяч» для целых рублей */
export function rublesInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount))
  if (n === 0) return 'ноль рублей'

  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []

  if (millions) {
    parts.push(triad(millions, false))
    parts.push(plural(millions, 'миллион', 'миллиона', 'миллионов'))
  }
  if (thousands) {
    parts.push(triad(thousands, true))
    parts.push(plural(thousands, 'тысяча', 'тысячи', 'тысяч'))
  }
  if (rest || (!millions && !thousands)) {
    parts.push(triad(rest, false))
  }
  parts.push(plural(rest || n, 'рубль', 'рубля', 'рублей'))
  return parts.filter(Boolean).join(' ')
}

export function formatMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDateRu(iso: string): { day: string; month: string; year: string; full: string } {
  const d = iso ? new Date(iso) : new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ]
  const month = months[d.getMonth()]
  const year = String(d.getFullYear())
  return { day, month, year, full: `«${day}» ${month} ${year} г.` }
}

export function splitPassport(raw: string): { series: string; number: string } {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const m = cleaned.match(/^(\d{2}\s?\d{2})\s+(\d{6})$/) || cleaned.match(/^(\d{4})\s+(\d{6})$/)
  if (m) return { series: m[1].replace(/\s/g, ' '), number: m[2] }
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length >= 10) {
    return { series: `${digits.slice(0, 2)} ${digits.slice(2, 4)}`, number: digits.slice(4, 10) }
  }
  return { series: cleaned, number: '' }
}

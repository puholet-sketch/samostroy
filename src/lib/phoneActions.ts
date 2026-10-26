/** Нормализация телефона к цифрам (РФ: 7XXXXXXXXXX) */
export function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 11 && d.startsWith('8')) return `7${d.slice(1)}`
  if (d.length === 10) return `7${d}`
  return d
}

/**
 * Маска ввода РФ: `+7 (999) 123-45-67`.
 * 8… и 10 цифр без кода страны приводятся к +7.
 */
export function formatRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('8')) d = `7${d.slice(1)}`
  if (!d.startsWith('7')) d = `7${d}`
  d = d.slice(0, 11)
  const rest = d.slice(1)
  if (!rest) return '+7'
  let out = `+7 (${rest.slice(0, 3)}`
  if (rest.length <= 3) return out
  out += `) ${rest.slice(3, 6)}`
  if (rest.length <= 6) return out
  out += `-${rest.slice(6, 8)}`
  if (rest.length <= 8) return out
  return `${out}-${rest.slice(8, 10)}`
}

export function telHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/[^\d+]/g, '')
  const normalized = digits.startsWith('+')
    ? `+${digits.slice(1).replace(/\D/g, '')}`
    : digits.replace(/\D/g, '')
  return normalized.length >= 5 ? `tel:${normalized}` : null
}

export function whatsappHref(raw: string): string | null {
  const d = phoneDigits(raw)
  return d.length >= 10 ? `https://wa.me/${d}` : null
}

/** Telegram: открывает чат по номеру, если контакт есть в TG */
export function telegramHref(raw: string): string | null {
  const d = phoneDigits(raw)
  return d.length >= 10 ? `https://t.me/+${d}` : null
}

/**
 * MAX (VK): открывает приложение/сайт.
 * Публичного deep-link по телефону пока нет — передаём номер в query для удобства.
 */
export function maxHref(raw: string): string | null {
  const d = phoneDigits(raw)
  if (d.length < 10) return null
  return `https://max.ru/?phone=${encodeURIComponent(`+${d}`)}`
}

/** Подстрока цифр запроса — непрерывная в номере (для поиска) */
export function phoneDigitsMatch(phone: string, queryDigits: string): boolean {
  if (!queryDigits) return true
  return phoneDigits(phone).includes(queryDigits)
}

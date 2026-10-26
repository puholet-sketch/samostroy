import {
  isFeedbackEmailConfigured,
  loadFeedbackEmailConfig,
} from './feedbackConfig'
import type { FeedbackItem } from './feedbackStore'

const WEB3FORMS_URL = 'https://api.web3forms.com/submit'
/** Бесплатный тариф Web3Forms: вложения — PRO; лимит попытки ~900 КБ. */
const MAX_ATTACH_BYTES = 900_000

export type FeedbackEmailResult = {
  ok: boolean
  attached: boolean
  skipped: boolean
  error?: string
}

function buildMessage(
  item: FeedbackItem,
  emailTo: string,
  attachNote: string,
): string {
  const markers =
    item.markers.length === 0
      ? '(нет)'
      : item.markers
          .map((m, i) => {
            const pos = `${m.type} @${m.x.toFixed(1)},${m.y.toFixed(1)}`
            return `${i + 1}. [${m.label}] ${pos}${m.note ? ` — ${m.note}` : ''}`
          })
          .join('\n')

  return [
    'Доставка: инбокс Access Key Web3Forms (email, с которым ключ создан и подтверждён).',
    `Метка команды (не меняет маршрут письма): ${emailTo}`,
    `ID: ${item.id}`,
    `Тема: ${item.title}`,
    `Тип: ${item.kind}`,
    `Автор: ${item.authorName} (${item.authorRole}, id=${item.authorId})`,
    `Маршрут: ${item.route}`,
    `Страница: ${item.pageTitle}`,
    `Сборка: ${item.buildStamp}`,
    `Создано: ${item.createdAt}`,
    '',
    'Описание:',
    item.body || '(пусто)',
    '',
    'Метки:',
    markers,
    '',
    attachNote,
  ].join('\n')
}

/** PNG → JPEG с уменьшением, чтобы уложиться в лимит письма. */
async function toCompressedJpeg(source: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(source)
    const maxSide = 1280
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    for (const q of [0.72, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', q),
      )
      if (blob && blob.size <= MAX_ATTACH_BYTES) return blob
      if (blob && q === 0.4) return blob.size < source.size ? blob : null
    }
    return null
  } catch {
    return null
  }
}

async function postWeb3FormsOnce(body: FormData | Record<string, unknown>): Promise<void> {
  const isFd = body instanceof FormData
  const res = await fetch(WEB3FORMS_URL, {
    method: 'POST',
    headers: isFd
      ? { Accept: 'application/json' }
      : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: isFd ? body : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Web3Forms ${res.status}`)
  }
}

function cloneBody(
  body: FormData | Record<string, unknown>,
): FormData | Record<string, unknown> {
  if (!(body instanceof FormData)) return body
  const fd = new FormData()
  body.forEach((value, key) => {
    fd.append(key, value)
  })
  return fd
}

/** Одна повторная попытка при сетевом/временном сбое. */
async function postWeb3Forms(body: FormData | Record<string, unknown>): Promise<void> {
  try {
    await postWeb3FormsOnce(cloneBody(body))
  } catch (first) {
    await new Promise((r) => setTimeout(r, 600))
    try {
      await postWeb3FormsOnce(cloneBody(body))
    } catch (second) {
      const msg =
        second instanceof Error
          ? second.message
          : first instanceof Error
            ? first.message
            : 'email error'
      throw new Error(msg)
    }
  }
}

/**
 * Отправка замечания на почту через Web3Forms (браузер → api.web3forms.com).
 * Без access key — skip. Вложение JPEG — best-effort (на free может не дойти).
 */
export async function sendFeedbackEmail(
  item: FeedbackItem,
  imageBlob: Blob,
): Promise<FeedbackEmailResult> {
  const cfg = loadFeedbackEmailConfig()
  if (!isFeedbackEmailConfigured(cfg)) {
    return { ok: false, attached: false, skipped: true }
  }

  const localOnlyNote =
    'Скриншот: только в браузере заказчика (локальный инбокс CRM). Вложение не приложено.'

  try {
    const jpeg = await toCompressedJpeg(imageBlob)
    const canAttach = Boolean(jpeg && jpeg.size <= MAX_ATTACH_BYTES)

    if (canAttach && jpeg) {
      try {
        const fd = new FormData()
        fd.append('access_key', cfg.accessKey)
        fd.append('subject', `[Самострой] Замечание: ${item.title}`)
        fd.append('from_name', item.authorName || 'Самострой CRM')
        fd.append('name', item.authorName || 'Ревизор')
        fd.append('email', 'noreply@samostroy.local')
        fd.append('replyto', 'noreply@samostroy.local')
        fd.append(
          'message',
          buildMessage(
            item,
            cfg.emailTo,
            'Скриншот: вложение JPEG (если тариф Web3Forms допускает файлы). Иначе смотрите локальный инбокс CRM.',
          ),
        )
        // team_inbox — только метаданные в письме; free Web3Forms не перенаправляет по to/email
        fd.append('team_inbox', cfg.emailTo)
        fd.append('feedback_id', item.id)
        fd.append('route', item.route)
        fd.append('build_stamp', item.buildStamp)
        fd.append('botcheck', '')
        fd.append('attachment', jpeg, `${item.id}.jpg`)
        await postWeb3Forms(fd)
        return { ok: true, attached: true, skipped: false }
      } catch {
        /* free / PRO — повторим без файла */
      }
    }

    await postWeb3Forms({
      access_key: cfg.accessKey,
      subject: `[Самострой] Замечание: ${item.title}`,
      from_name: item.authorName || 'Самострой CRM',
      name: item.authorName || 'Ревизор',
      email: 'noreply@samostroy.local',
      replyto: 'noreply@samostroy.local',
      message: buildMessage(
        item,
        cfg.emailTo,
        canAttach
          ? `${localOnlyNote} (вложение отклонено провайдером — нужен Web3Forms PRO или смотрите CRM).`
          : `${localOnlyNote} JPEG слишком большой или недоступен.`,
      ),
      team_inbox: cfg.emailTo,
      feedback_id: item.id,
      route: item.route,
      build_stamp: item.buildStamp,
      botcheck: '',
    })
    return { ok: true, attached: false, skipped: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'email error'
    return { ok: false, attached: false, skipped: false, error: msg }
  }
}

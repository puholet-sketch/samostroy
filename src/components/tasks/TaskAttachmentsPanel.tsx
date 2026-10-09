import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { TaskAttachment } from '../../services/types'
import {
  MAX_ATTACHMENT_BYTES,
  attachmentKind,
  deleteMediaBlob,
  formatBytes,
  getMediaBlob,
  putMediaBlob,
} from '../../lib/mediaStore'
import { formatDateTimeRu } from '../../lib/userDisplay'

type Props = {
  attachments: TaskAttachment[]
  writable: boolean
  authorId: string
  busy?: boolean
  onChange: (next: TaskAttachment[]) => Promise<void>
}

function newAttId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function AttachmentThumb({ att }: { att: TaskAttachment }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    void (async () => {
      const blob = await getMediaBlob(att.id)
      if (cancelled || !blob) return
      const u = URL.createObjectURL(blob)
      revoked = u
      setUrl(u)
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [att.id])

  if (att.kind === 'image' && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={att.name}
          className="h-28 w-full object-cover rounded-lg border border-gray-200 bg-gray-50"
        />
      </a>
    )
  }

  if (att.kind === 'video' && url) {
    return (
      <video
        src={url}
        controls
        className="h-40 w-full rounded-lg border border-gray-200 bg-black object-contain"
      />
    )
  }

  return (
    <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500 px-2 text-center">
      {url ? (
        <a href={url} download={att.name} className="text-primary-600 hover:underline break-all">
          Скачать {att.name}
        </a>
      ) : (
        'Файл недоступен в этом браузере'
      )}
    </div>
  )
}

export default function TaskAttachmentsPanel({
  attachments,
  writable,
  authorId,
  busy,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !writable) return

    setError('')
    setUploading(true)
    try {
      const added: TaskAttachment[] = []
      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(`«${file.name}» больше ${formatBytes(MAX_ATTACHMENT_BYTES)}`)
          continue
        }
        const kind = attachmentKind(file.type || 'application/octet-stream')
        if (kind === 'file') {
          setError(`«${file.name}»: нужны фото или видео`)
          continue
        }
        const id = newAttId()
        await putMediaBlob(id, file)
        added.push({
          id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          kind,
          authorId,
          createdAt: new Date().toISOString(),
        })
      }
      if (added.length) {
        await onChange([...attachments, ...added])
      }
    } catch {
      setError('Не удалось сохранить файл')
    } finally {
      setUploading(false)
    }
  }

  async function onRemove(att: TaskAttachment) {
    if (!writable) return
    if (!window.confirm(`Удалить вложение «${att.name}»?`)) return
    await deleteMediaBlob(att.id)
    await onChange(attachments.filter((a) => a.id !== att.id))
  }

  return (
    <div className="card p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          Фото и видео
          {attachments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">{attachments.length}</span>
          )}
        </h2>
        {writable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void onFilesSelected(e)}
            />
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Загрузка…' : '+ Прикрепить'}
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Файлы хранятся в браузере (IndexedDB), в JSON только метаданные. До{' '}
        {formatBytes(MAX_ATTACHMENT_BYTES)} на файл.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-400">Пока нет вложений</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att) => (
            <li key={att.id} className="border border-gray-200 rounded-xl p-2 space-y-2">
              <AttachmentThumb att={att} />
              <div className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate" title={att.name}>
                    {att.name}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {att.kind === 'image' ? 'Фото' : 'Видео'} · {formatBytes(att.size)} ·{' '}
                    {formatDateTimeRu(att.createdAt)}
                  </div>
                </div>
                {writable && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline shrink-0 min-h-8 px-1"
                    onClick={() => void onRemove(att)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

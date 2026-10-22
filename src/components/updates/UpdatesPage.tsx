import { useEffect } from 'react'
import changelog from '@data/changelog.json'

type ChangeItem = { section: string; text: string }
type Release = { id: string; at: string; title: string; items: ChangeItem[] }

const releases = changelog as Release[]

function formatAt(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function UpdatesPage() {
  useEffect(() => {
    document.title = 'Обновления — СамоСтрой'
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm text-gray-500">
        Краткая история релизов: что добавилось и в каком разделе.
      </p>
      <ol className="space-y-4">
        {releases.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">{r.title}</h2>
              <time className="text-xs tabular-nums text-gray-400" dateTime={r.at}>
                {formatAt(r.at)}
              </time>
            </div>
            <ul className="mt-3 space-y-1.5">
              {r.items.map((it, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium text-blue-700">{it.section}</span>
                  <span className="text-gray-400"> — </span>
                  {it.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

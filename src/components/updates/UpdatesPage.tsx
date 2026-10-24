import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BUILD_STAMP } from '../../lib/buildStamp'
import { RELEASES } from '../../lib/changelog'
import { getReleaseNarrative } from '../../lib/releaseNarratives'

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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-gray-500">
          История релизов: кратко в списке, подробно — на странице релиза (возможности + ссылки на
          системную документацию).
        </p>
        <p className="text-[11px] tabular-nums text-gray-400">{BUILD_STAMP}</p>
      </div>

      {RELEASES.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
          Список обновлений не загрузился. Обновите страницу (Ctrl+F5) или сообщите в поддержку.
        </p>
      ) : (
        <ol className="space-y-4">
          {RELEASES.map((r) => {
            const hasNarrative = Boolean(getReleaseNarrative(r.id))
            return (
              <li
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    <Link
                      to={`/updates/${r.id}`}
                      className="hover:text-blue-800 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </h2>
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
                <p className="mt-3">
                  <Link
                    to={`/updates/${r.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    Подробнее{hasNarrative ? '' : ' и документация'} →
                  </Link>
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

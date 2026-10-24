import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getReleaseById, type ReleaseDocLink } from '../../lib/changelog'
import { getReleaseNarrative } from '../../lib/releaseNarratives'
import { MarkdownBody } from './MarkdownBody'

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

function DocLinkRow({ link }: { link: ReleaseDocLink }) {
  if (link.kind === 'app') {
    return (
      <li>
        <Link to={link.href} className="font-medium text-blue-700 hover:underline">
          {link.label}
        </Link>
        <span className="ml-2 font-mono text-[11px] text-gray-400">{link.href}</span>
      </li>
    )
  }
  return (
    <li>
      <span className="font-medium text-gray-800">{link.label}</span>
      <span className="ml-2 font-mono text-[11px] text-gray-500">{link.href}</span>
      <span className="ml-1 text-[11px] text-gray-400">(в репозитории)</span>
    </li>
  )
}

export default function ReleaseDetailPage() {
  const { releaseId = '' } = useParams<{ releaseId: string }>()
  const release = getReleaseById(releaseId)
  const narrative = release ? getReleaseNarrative(release.id) : undefined

  useEffect(() => {
    if (release) document.title = `${release.title} — Обновления — СамоСтрой`
  }, [release])

  if (!release) {
    return <Navigate to="/updates" replace />
  }

  const docs = release.docs ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/updates" className="text-sm font-medium text-blue-700 hover:underline">
          ← Все обновления
        </Link>
      </div>

      <header className="space-y-1 border-b border-gray-200 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">{release.title}</h1>
        <p className="text-xs tabular-nums text-gray-400">
          <time dateTime={release.at}>{formatAt(release.at)}</time>
          <span className="mx-1.5 text-gray-300">·</span>
          <span className="font-mono">{release.id}</span>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Кратко</h2>
        <ul className="space-y-1.5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {release.items.map((it, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="font-medium text-blue-700">{it.section}</span>
              <span className="text-gray-400"> — </span>
              {it.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Возможности для бизнеса
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          {narrative ? (
            <MarkdownBody source={narrative} />
          ) : (
            <p className="text-sm text-gray-600">
              Развёрнутое описание для этого релиза ещё не добавлено. Краткие пункты — выше; системная
              документация — в блоке ниже (если указана).
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Системная документация
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {docs.length === 0 ? (
            <p className="text-sm text-gray-600">
              Ссылки на docs для этого релиза не заданы. Общая карта:{' '}
              <span className="font-mono text-[12px] text-gray-500">docs/architecture.md</span>,{' '}
              <span className="font-mono text-[12px] text-gray-500">docs/modules/README.md</span>.
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {docs.map((d, i) => (
                <DocLinkRow key={i} link={d} />
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-400">
            Файлы `docs/…` живут в репозитории проекта (не открываются как страницы CRM). Маршруты
            `/…` — разделы приложения.
          </p>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import { wizardHrefForDoc } from '../../lib/docActions'
import {
  kindLabel,
  listIssuedDocs,
  statusLabel,
  type IssuedDocKind,
} from '../../lib/docRegistry'
import { loadClients } from '../../lib/clients'

const TILES: {
  to: string
  title: string
  desc: string
  soon?: boolean
}[] = [
  {
    to: '/documents/design',
    title: 'Договор дизайна',
    desc: 'Клиент → объект → тариф → выпуск и скачивание',
  },
  {
    to: '/documents/repair',
    title: 'Договор ремонта',
    desc: 'Калькулятор сметы в мастере → согласование → договор + ТЗ',
  },
  {
    to: '/documents/acts',
    title: 'Акты',
    desc: 'Смета в мастере · строки из согласованного договора',
  },
  {
    to: '/documents/furniture',
    title: 'Договор мебелировки',
    desc: 'Скоро',
    soon: true,
  },
]

/** py-2 + ~20px line ≈ 36–40; fallback until first measure */
const ROW_H_FALLBACK = 40
const VISIBLE_MIN = 2
const VISIBLE_MAX = 40

/** AppShell h-14 + main py-4 top/bottom */
const HUB_FILL =
  'flex h-[calc(100dvh-3.5rem-2rem)] max-h-[calc(100dvh-3.5rem-2rem)] flex-col gap-4 overflow-hidden'

export default function DocumentsHub() {
  const [tick, setTick] = useState(0)
  const [visibleCount, setVisibleCount] = useState(8)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Договоры — СамоСтрой'
  }, [])

  const headerBtn = useMemo(
    () => (
      <Link
        to="/documents/registry"
        className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 sm:px-4"
      >
        Реестры →
      </Link>
    ),
    [],
  )
  usePageHeaderActions(headerBtn)

  const allRecent = useMemo(() => {
    void tick
    return listIssuedDocs()
  }, [tick])

  const clients = useMemo(() => loadClients(), [tick])
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name || id

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const measure = () => {
      const h = el.clientHeight
      const firstRow = el.querySelector('li')
      const rowH = firstRow?.getBoundingClientRect().height || ROW_H_FALLBACK
      const n = Math.floor(h / Math.max(rowH, 1))
      setVisibleCount(Math.max(VISIBLE_MIN, Math.min(VISIBLE_MAX, n || VISIBLE_MIN)))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [allRecent.length, tick])

  const recent = allRecent.slice(0, visibleCount)

  return (
    <div className={`-mx-1 ${HUB_FILL}`}>
      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        {TILES.map((t) =>
          t.soon ? (
            <div
              key={t.to}
              className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 opacity-80"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-800">{t.title}</h2>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  скоро
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{t.desc}</p>
              <Link
                to={t.to}
                className="mt-3 inline-block text-sm font-medium text-gray-600 hover:underline"
              >
                Открыть заглушку →
              </Link>
            </div>
          ) : (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{t.desc}</p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-700">
                Начать →
              </span>
            </Link>
          ),
        )}
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Недавние документы</h2>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setTick((t) => t + 1)}
          >
            Обновить
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-hidden">
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">Пока пусто — выпустите первый договор из плитки.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {recent.map((d) => {
                const href = wizardHrefForDoc(d)
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    {href ? (
                      <Link
                        to={href}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {kindLabel(d.kind as IssuedDocKind)}
                        {d.contractNumber ? ` № ${d.contractNumber}` : ''}
                        {d.actStageNumber != null ? ` · этап ${d.actStageNumber}` : ''}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {kindLabel(d.kind as IssuedDocKind)}
                        {d.contractNumber ? ` № ${d.contractNumber}` : ''}
                        {d.actStageNumber != null ? ` · этап ${d.actStageNumber}` : ''}
                      </span>
                    )}
                    <span className="text-gray-500">{nameOf(d.clientId)}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                      {statusLabel(d.status)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-2 flex shrink-0 justify-end border-t border-gray-100 pt-2">
          <Link to="/documents/registry" className="text-xs text-blue-700 hover:underline">
            Реестр →
          </Link>
        </div>
      </section>
    </div>
  )
}

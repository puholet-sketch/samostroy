import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  kindLabel,
  listIssuedDocs,
  peekContractCounter,
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
    desc: 'Смета, согласование, договор + ТЗ',
  },
  {
    to: '/documents/acts',
    title: 'Акты',
    desc: 'Только из согласованных договоров ремонта',
  },
  {
    to: '/documents/furniture',
    title: 'Договор мебелировки',
    desc: 'Скоро',
    soon: true,
  },
]

export default function DocumentsHub() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    document.title = 'Документы — СамоСтрой'
  }, [])

  const recent = useMemo(() => {
    void tick
    return listIssuedDocs().slice(0, 8)
  }, [tick])

  const clients = useMemo(() => loadClients(), [tick])
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name || id

  return (
    <div className="-mx-1 space-y-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Документы</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Выберите тип · сквозной № договоров сейчас:{' '}
            <span className="font-medium text-gray-800">{peekContractCounter()}</span>
          </p>
        </div>
        <Link
          to="/documents/registry"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => setTick((t) => t + 1)}
        >
          Реестры →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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

      <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Недавние документы</h2>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setTick((t) => t + 1)}
          >
            Обновить
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Пока пусто — выпустите первый договор из плитки.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium text-gray-900">
                  {kindLabel(d.kind as IssuedDocKind)}
                  {d.contractNumber ? ` № ${d.contractNumber}` : ''}
                  {d.actStageNumber != null ? ` · этап ${d.actStageNumber}` : ''}
                </span>
                <span className="text-gray-500">{nameOf(d.clientId)}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                  {statusLabel(d.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

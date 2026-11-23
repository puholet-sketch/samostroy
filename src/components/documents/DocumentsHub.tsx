import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import DocRegistryPanel from './DocRegistryPanel'

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

export default function DocumentsHub() {
  useEffect(() => {
    document.title = 'Договоры — СамоСтрой'
  }, [])

  return (
    <div className="-mx-1 space-y-4 pb-6">
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

      <DocRegistryPanel title="Реестр договоров" />
    </div>
  )
}

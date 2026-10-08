import { Link } from 'react-router-dom'
import { useObjects } from '../../hooks/useObjects'

const STATUS_LABEL: Record<string, string> = {
  lead: 'Лид',
  design: 'Дизайн',
  contract: 'Договор',
  in_progress: 'В работе',
  done: 'Завершён',
}

export default function ObjectsPage() {
  const { objects, loading } = useObjects()

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Объекты</h1>
          <p className="text-sm text-gray-500 mt-1">CRM-карточки для продавцов и производство</p>
        </div>
        <span className="text-sm text-gray-400">{loading ? '…' : `${objects.length} шт.`}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {objects.map((o) => {
          const paid = o.stages.filter((s) => s.paid).length
          const total = o.stages.reduce((a, s) => a + s.plannedAmount, 0)
          return (
            <Link key={o.id} to={`/objects/${o.id}`} className="card p-5 hover:border-primary-300 transition-colors block">
              <div className="flex justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{o.title}</h2>
                <span className="badge-blue shrink-0">{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 line-clamp-2">{o.address}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>
                  <dt className="text-gray-400">Площадь</dt>
                  <dd>{o.areaM2} м²</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Контакт</dt>
                  <dd>{o.contacts[0]?.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">След. шаг</dt>
                  <dd className="truncate">{o.crm.nextStep || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Этапы оплачены</dt>
                  <dd>
                    {paid}/14 · {total.toLocaleString('ru-RU')} ₽
                  </dd>
                </div>
              </dl>
            </Link>
          )
        })}
      </div>
      {!loading && objects.length === 0 && (
        <div className="card p-8 text-center text-gray-500">Нет объектов для вашей роли</div>
      )}
    </div>
  )
}

import type { ObjectStage, StageStatus } from '../../services/types'

const STATUS_OPTS: { value: StageStatus; label: string }[] = [
  { value: 'planned', label: 'План' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done_pending_act', label: 'Ждёт акт' },
  { value: 'closed', label: 'Закрыт' },
]

export default function PipelinePanel({
  stages,
  onChange,
  writable,
  clientMode,
}: {
  stages: ObjectStage[]
  onChange: (stages: ObjectStage[]) => void
  writable: boolean
  clientMode: boolean
}) {
  const visible = clientMode ? stages.filter((s) => s.clientVisible) : stages

  function patch(n: number, partial: Partial<ObjectStage>) {
    onChange(stages.map((s) => (s.n === n ? { ...s, ...partial } : s)))
  }

  const totalPlanned = visible.reduce((a, s) => a + s.plannedAmount, 0)
  const totalPaid = visible.reduce((a, s) => a + s.paidAmount, 0)

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Этапы работ (14)</h2>
          <p className="text-xs text-gray-500 mt-1">
            Шаблон из REMONT · суммы per object
            {clientMode ? ' · только clientVisible' : ''}
          </p>
        </div>
        <div className="text-sm text-gray-600">
          План: <span className="font-medium">{totalPlanned.toLocaleString('ru-RU')} ₽</span>
          {' · '}
          Оплачено: <span className="font-medium">{totalPaid.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-gray-500">Нет этапов, открытых для клиента (clientVisible).</p>
      )}

      <div className="table-scroll">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 pr-2">№</th>
              <th className="py-2 pr-2">Этап</th>
              <th className="py-2 pr-2">Сумма</th>
              <th className="py-2 pr-2">Статус</th>
              <th className="py-2 pr-2">Акт</th>
              <th className="py-2 pr-2">Оплата</th>
              {!clientMode && <th className="py-2">Клиенту</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.n} className="border-b border-gray-50 align-top">
                <td className="py-2 pr-2 text-gray-400">{s.n}</td>
                <td className="py-2 pr-2 font-medium text-gray-900 min-w-[12rem]">{s.name}</td>
                <td className="py-2 pr-2">
                  {writable ? (
                    <input
                      type="number"
                      className="input w-28"
                      value={s.plannedAmount}
                      onChange={(e) => patch(s.n, { plannedAmount: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    <span>{s.plannedAmount.toLocaleString('ru-RU')} ₽</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {writable ? (
                    <select
                      className="input w-36"
                      value={s.status}
                      onChange={(e) => patch(s.n, { status: e.target.value as StageStatus })}
                    >
                      {STATUS_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge-gray">{STATUS_OPTS.find((o) => o.value === s.status)?.label}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    disabled={!writable}
                    checked={s.actSigned}
                    onChange={(e) => patch(s.n, { actSigned: e.target.checked })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <div className="flex flex-col gap-1">
                    <label className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        disabled={!writable}
                        checked={s.paid}
                        onChange={(e) => patch(s.n, { paid: e.target.checked })}
                      />
                      оплачен
                    </label>
                    {writable ? (
                      <input
                        type="number"
                        className="input w-28"
                        value={s.paidAmount}
                        onChange={(e) => patch(s.n, { paidAmount: Number(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{s.paidAmount.toLocaleString('ru-RU')} ₽</span>
                    )}
                  </div>
                </td>
                {!clientMode && (
                  <td className="py-2">
                    <input
                      type="checkbox"
                      disabled={!writable}
                      checked={s.clientVisible}
                      onChange={(e) => patch(s.n, { clientVisible: e.target.checked })}
                      title="Показывать клиенту"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

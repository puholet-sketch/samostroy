type KpiProps = {
  label: string
  value: string | number
  accent?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose'
}

const ACCENT: Record<NonNullable<KpiProps['accent']>, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  indigo: 'border-l-indigo-500',
  rose: 'border-l-rose-500',
}

/** Компактный KPI — единый стиль на всех разделах */
export function Kpi({ label, value, accent = 'blue' }: KpiProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border border-gray-200 border-l-4 bg-white px-3 py-2.5 shadow-sm ${ACCENT[accent]}`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${title || action ? 'mb-4' : ''}`}>
          {title ? <h2 className="text-base font-semibold text-gray-900">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/** Панель без заголовка — только поиск/действие сверху */
export function PanelToolbar({
  action,
  children,
  className = '',
}: {
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {action && <div className="mb-4 flex justify-end">{action}</div>}
      {children}
    </div>
  )
}

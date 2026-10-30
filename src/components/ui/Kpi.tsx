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

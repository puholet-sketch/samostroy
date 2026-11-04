import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WizardShell } from './docUi'

export default function FurnitureStubPage() {
  useEffect(() => {
    document.title = 'Мебелировка — СамоСтрой'
  }, [])

  return (
    <WizardShell title="Договор мебелировки">
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
        <p className="text-lg font-semibold text-amber-950">Скоро</p>
        <p className="mt-2 text-sm text-amber-900/80">
          Плитка зарезервирована. Шаблоны и правила договора мебелировки появятся после
          материалов от заказчика. Сквозной нумератор договоров уже общий с дизайном и
          ремонтом.
        </p>
        <Link
          to="/documents"
          className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          ← Вернуться в хаб
        </Link>
      </div>
    </WizardShell>
  )
}

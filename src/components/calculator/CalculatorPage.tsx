import { useEffect } from 'react'
import { usePageHeaderActions } from '../../contexts/PageHeaderContext'
import CalculatorPanel from './CalculatorPanel'

/** Standalone page kept for deep-links; App redirects /calculator → repair. */
export default function CalculatorPage() {
  usePageHeaderActions(null)

  useEffect(() => {
    document.title = 'Калькулятор — СамоСтрой'
  }, [])

  return <CalculatorPanel />
}

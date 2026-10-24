import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { countOpenFeedback } from '../../lib/feedbackStore'
import { FeedbackCapture, FeedbackFab } from './FeedbackCapture'

type Props = {
  /** Открытие из сайдбара */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** FAB + мастер замечаний внутри AppShell. */
export function FeedbackHost({ open: openProp, onOpenChange }: Props) {
  const { can } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? Boolean(openProp) : internalOpen

  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v)
      onOpenChange?.(v)
    },
    [controlled, onOpenChange],
  )

  if (!can('feedback')) return null

  return (
    <>
      <FeedbackFab onOpen={() => setOpen(true)} />
      <FeedbackCapture open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function useFeedbackOpenCount(enabled: boolean): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const tick = () => setN(countOpenFeedback())
    tick()
    const id = window.setInterval(tick, 4000)
    return () => window.clearInterval(id)
  }, [enabled])
  return n
}

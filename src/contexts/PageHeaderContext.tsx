import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type PageHeaderContextValue = {
  actions: ReactNode
  setActions: (node: ReactNode) => void
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null)
  const setActions = useCallback((node: ReactNode) => {
    setActionsState(node)
  }, [])
  const value = useMemo(() => ({ actions, setActions }), [actions, setActions])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

/** Страница регистрирует кнопки в шапке рядом с заголовком; при размонтировании очищает. */
export function usePageHeaderActions(node: ReactNode) {
  const ctx = useContext(PageHeaderContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setActions(node)
    return () => ctx.setActions(null)
  }, [ctx, node])
}

export function usePageHeaderSlot() {
  const ctx = useContext(PageHeaderContext)
  return ctx?.actions ?? null
}

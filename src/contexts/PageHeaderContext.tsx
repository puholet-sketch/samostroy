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
  meta: ReactNode
  setMeta: (node: ReactNode) => void
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null)
  const [meta, setMetaState] = useState<ReactNode>(null)
  const setActions = useCallback((node: ReactNode) => {
    setActionsState(node)
  }, [])
  const setMeta = useCallback((node: ReactNode) => {
    setMetaState(node)
  }, [])
  const value = useMemo(
    () => ({ actions, setActions, meta, setMeta }),
    [actions, setActions, meta, setMeta],
  )
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

/** Мета справа от заголовка (телефон и т.п.). */
export function usePageHeaderMeta(node: ReactNode) {
  const ctx = useContext(PageHeaderContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setMeta(node)
    return () => ctx.setMeta(null)
  }, [ctx, node])
}

export function usePageHeaderSlot() {
  const ctx = useContext(PageHeaderContext)
  return ctx?.actions ?? null
}

export function usePageHeaderMetaSlot() {
  const ctx = useContext(PageHeaderContext)
  return ctx?.meta ?? null
}

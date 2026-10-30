import { useEffect, useId, useRef, useState } from 'react'
import {
  DEBOUNCE_MS,
  MIN_QUERY,
  findExactSuggestion,
  normalizeAddressLabel,
  suggestAddresses,
  type AddressSuggestion,
} from '../../lib/addressSuggest'

type Validity = 'empty' | 'valid' | 'unverified'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Called when user picks a suggestion (canonical label + coords). */
  onSelect?: (s: AddressSuggestion) => void
  disabled?: boolean
  placeholder?: string
  title?: string
  className?: string
  /** Extra classes on the input (layout); border/ring overridden by validity. */
  inputClassName?: string
  id?: string
}

const baseInput =
  'block w-full rounded-md bg-white px-2 py-1.5 text-sm leading-tight text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1'

function borderCls(v: Validity): string {
  if (v === 'valid') {
    return 'border border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500 pr-8'
  }
  if (v === 'unverified') {
    return 'border border-amber-400 focus:border-amber-500 focus:ring-amber-400'
  }
  return 'border border-gray-300 focus:border-blue-500 focus:ring-blue-500'
}

export function AddressInput({
  value,
  onChange,
  onSelect,
  disabled,
  placeholder = 'Улица, дом, кв. — выберите из подсказок',
  title,
  className = '',
  inputClassName = '',
  id,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  /** Canonical label last confirmed via suggestion pick or exact match. */
  const [verified, setVerified] = useState<string>(() => '')
  const skipFetchRef = useRef(false)

  const validity: Validity = !value.trim()
    ? 'empty'
    : normalizeAddressLabel(value) === normalizeAddressLabel(verified)
      ? 'valid'
      : 'unverified'

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }
    const q = value.trim()
    if (q.length < MIN_QUERY || disabled) {
      setItems([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const next = await suggestAddresses(q, ac.signal)
          if (ac.signal.aborted) return
          setItems(next)
          setActive(next.length ? 0 : -1)
          const exact = findExactSuggestion(q, next)
          if (exact) {
            setVerified(exact.label)
          }
        } catch {
          if (!ac.signal.aborted) setItems([])
        } finally {
          if (!ac.signal.aborted) setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      ac.abort()
      window.clearTimeout(t)
    }
  }, [value, disabled])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(s: AddressSuggestion) {
    skipFetchRef.current = true
    setVerified(s.label)
    setItems([])
    setOpen(false)
    setActive(-1)
    onChange(s.label)
    onSelect?.(s)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      setOpen(true)
      e.preventDefault()
      return
    }
    if (!open || !items.length) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0 && items[active]) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const showList = open && !disabled && (loading || items.length > 0 || value.trim().length >= MIN_QUERY)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          disabled={disabled}
          title={title}
          placeholder={placeholder}
          autoComplete="off"
          className={`${baseInput} ${borderCls(validity)} ${inputClassName}`}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (normalizeAddressLabel(v) !== normalizeAddressLabel(verified)) {
              /* keep verified until exact match / pick */
            }
            onChange(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {validity === 'valid' && (
          <span
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-emerald-600"
            aria-hidden
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </div>
      {validity === 'unverified' && !showList && (
        <p className="mt-0.5 text-[11px] leading-tight text-amber-700">
          Выберите адрес из подсказок — так он будет проверен
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {loading && items.length === 0 && (
            <li className="px-2.5 py-1.5 text-gray-400">Поиск адресов…</li>
          )}
          {!loading && items.length === 0 && value.trim().length >= MIN_QUERY && (
            <li className="px-2.5 py-1.5 text-gray-400">Ничего не найдено</li>
          )}
          {items.map((s, i) => (
            <li
              key={`${s.lat}-${s.lng}-${s.label}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-2.5 py-1.5 ${
                i === active ? 'bg-blue-50 text-blue-900' : 'text-gray-800 hover:bg-gray-50'
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { RiCalculatorFill } from '@remixicon/react'
import { Link } from 'react-router-dom'
import { loadCalcTransfer, saveCalcTransfer, type CalcSmetaLine } from '../../lib/calcTransfer'
import {
  agreeCalcVersion,
  applyVersionToTransfer,
  clearAgreedCalcVersion,
  deleteCalcVersion,
  getAgreedCalcVersion,
  listCalcVersions,
  renameCalcVersion,
  saveCalcVersionFromTransfer,
  versionStatusLabel,
  type CalcVersion,
} from '../../lib/calcVersions'
import { loadClients, type ClientCard, type ClientObject } from '../../lib/clients'
import { CONTRACTOR, DESIGN_RATE_PER_M2 } from '../../lib/contractor'
import {
  generateAktDoc,
  generateDesignDoc,
  generateRemontDoc,
  generateSmetaDoc,
  type AktLine,
  type SmetaLine,
} from '../../lib/generateDocs'
import { formatMoney, rublesInWords } from '../../lib/moneyRu'
import { AddressInput } from '../ui/AddressInput'
import { PhoneActions } from '../ui/PhoneActions'

type DocKind = 'remont' | 'design' | 'akt' | 'smeta'

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function Field({
  label,
  children,
  className = '',
  hint,
}: {
  label: string
  children: React.ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-[11px] font-medium leading-tight text-gray-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{hint}</span>}
    </label>
  )
}

function clientHaystack(c: ClientCard): string {
  return [
    c.name,
    c.email,
    c.mobile,
    c.mobile2,
    c.city,
    c.tag,
    c.source,
    c.manager,
    c.designer,
    c.picker,
    c.prorab,
    c.otk,
    c.address,
    c.passport_number,
    c.inn,
    c.objects_note,
    c.dogovor_design,
    c.dogovor_otdelka,
    c.smeta,
    ...c.objects.flatMap((o) => [o.title, o.address, o.contractNumber]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function objectLabel(o: ClientObject): string {
  const main = o.title && o.address && o.title !== o.address ? `${o.title} — ${o.address}` : o.address || o.title || 'Объект'
  return o.contractNumber ? `${main} · дог. ${o.contractNumber}` : main
}

function missingFromCard(c: ClientCard): string[] {
  const miss: string[] = []
  if (!c.name.trim()) miss.push('ФИО / название')
  if (!c.mobile.trim()) miss.push('мобильный')
  if (c.fizurlico === 'fiz') {
    if (!c.passport_number.trim()) miss.push('номер паспорта')
    if (!c.passport_issued.trim()) miss.push('кем выдан паспорт')
    if (!c.passport_date_issued.trim()) miss.push('дата выдачи паспорта')
    if (!c.address.trim()) miss.push('адрес регистрации')
  } else {
    if (!c.inn.trim()) miss.push('ИНН')
    if (!c.address_ur.trim()) miss.push('юр. адрес')
  }
  return miss
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function DocumentsPage() {
  const [clients, setClients] = useState<ClientCard[]>(() => loadClients())
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState('')
  const [objectId, setObjectId] = useState('')
  const [kind, setKind] = useState<DocKind>('remont')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [calcMenuOpen, setCalcMenuOpen] = useState(false)
  const calcMenuRef = useRef<HTMLDivElement>(null)

  const [remont, setRemont] = useState({
    number: '',
    date: todayIso(),
    city: 'Москва',
    objectAddress: '',
    areaM2: 0,
    totalSum: 0,
    workDays: 80,
  })
  const [design, setDesign] = useState({
    number: '',
    date: todayIso(),
    city: 'Москва',
    objectAddress: '',
    areaM2: 0,
  })
  const [akt, setAkt] = useState({
    number: '',
    date: todayIso(),
    city: 'Москва',
    objectAddress: '',
    stageName: '',
    paid: 0,
    lines: [
      { name: '', unit: 'ед.', qty: 1, price: 0 },
      { name: '', unit: 'ед.', qty: 1, price: 0 },
    ] as AktLine[],
  })
  const [smeta, setSmeta] = useState({
    number: '',
    date: todayIso(),
    city: 'Москва',
    objectAddress: '',
    objectTitle: '',
    areaM2: 0,
    workDays: 100,
    discountPct: 0,
    rolledUp: false,
    lines: [
      { name: '', unit: 'ед.', qty: 1, price: 0, section: 'Прочее' },
    ] as SmetaLine[],
    fromCalc: false,
  })
  const [executorName, setExecutorName] = useState<string>(CONTRACTOR.name)
  const [calcTransfer, setCalcTransfer] = useState(() => loadCalcTransfer())
  /** Индексы строк калькулятора, включённые в текущий акт */
  const [aktSelected, setAktSelected] = useState<Record<number, boolean>>({})
  const [aktStageIdx, setAktStageIdx] = useState(0)
  const [calcVersions, setCalcVersions] = useState<CalcVersion[]>([])
  const [versionMsg, setVersionMsg] = useState('')

  useEffect(() => {
    document.title = 'Договоры и акты — СамоСтрой'
    const list = loadClients()
    setClients(list)
    setCalcTransfer(loadCalcTransfer())
    // один клиент в базе — выбираем сразу (и объект, если один)
    if (list.length === 1) {
      // отложенно через тот же путь, что и клик по списку
      const c = list[0]
      setClientId(c.id)
      const objs = c.objects ?? []
      if (objs.length === 1) {
        setObjectId(objs[0].id)
        applyObjectToForms(objs[0], c.city || 'Москва', c.id)
      } else if (objs.length === 0) {
        const fallback = (c.objects_note || c.address || '').trim()
        setRemont((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
        setDesign((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
        setAkt((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
        setSmeta((f) => ({
          ...f,
          city: c.city || f.city,
          objectAddress: fallback,
        }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  useEffect(() => {
    if (kind !== 'remont' && kind !== 'smeta') return
    const t = loadCalcTransfer()
    setCalcTransfer(t)
    if (kind === 'remont' && t.transferToRemont && t.total > 0) {
      setRemont((f) => ({ ...f, totalSum: t.total }))
    }
    if (kind === 'smeta' && t.lines.length > 0) {
      setSmeta((f) => ({
        ...f,
        discountPct: t.discountPct || 0,
        lines: t.lines.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section || 'Прочее',
        })),
        fromCalc: true,
      }))
    }
  }, [kind])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients
    return clients.filter((c) => clientHaystack(c).includes(s))
  }, [clients, q])

  const client = clients.find((c) => c.id === clientId) ?? null
  const clientObjects = client?.objects ?? []
  const selectedObject = clientObjects.find((o) => o.id === objectId) ?? null

  function applyObjectToForms(
    obj: ClientObject,
    cityFallback: string,
    forClientId?: string,
  ) {
    const addr = obj.address?.trim() || ''
    const title = obj.title?.trim() || ''
    const num = obj.contractNumber?.trim() || ''
    const city = cityFallback || 'Москва'
    const area = Number(obj.areaM2) || 0

    setRemont((f) => ({
      ...f,
      city: city || f.city,
      objectAddress: addr,
      number: num || f.number,
      areaM2: area || f.areaM2,
    }))
    setDesign((f) => ({
      ...f,
      city: city || f.city,
      objectAddress: addr,
      number: num || f.number,
      areaM2: area || f.areaM2,
    }))
    setAkt((f) => ({
      ...f,
      city: city || f.city,
      objectAddress: addr,
      number: num || f.number,
    }))
    setSmeta((f) => ({
      ...f,
      city: city || f.city,
      objectAddress: addr,
      objectTitle: title,
      number: num || f.number,
      areaM2: area || f.areaM2,
    }))

    const cid = forClientId || clientId
    const agreed = cid ? getAgreedCalcVersion(cid, obj.id) : undefined
    if (agreed && agreed.lines.length > 0) {
      setCalcTransfer((t) => ({
        ...t,
        transferToRemont: true,
        withDetails: true,
        total: agreed.total,
        baseTotal: agreed.baseTotal,
        discountPct: agreed.discountPct,
        lines: agreed.lines,
        updatedAt: agreed.updatedAt,
      }))
      setRemont((f) => ({ ...f, totalSum: agreed.total }))
      setSmeta((f) => ({
        ...f,
        discountPct: agreed.discountPct,
        lines: agreed.lines.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section || 'Прочее',
        })),
        fromCalc: true,
      }))
    }
  }

  function pickClient(c: ClientCard) {
    setClientId(c.id)
    setQ('')
    setMsg('')
    const objs = c.objects ?? []
    if (objs.length === 1) {
      setObjectId(objs[0].id)
      applyObjectToForms(objs[0], c.city || 'Москва', c.id)
    } else if (objs.length > 1) {
      setObjectId('')
      setRemont((f) => ({ ...f, city: c.city || f.city, objectAddress: '' }))
      setDesign((f) => ({ ...f, city: c.city || f.city, objectAddress: '' }))
      setAkt((f) => ({ ...f, city: c.city || f.city, objectAddress: '' }))
      setSmeta((f) => ({
        ...f,
        city: c.city || f.city,
        objectAddress: '',
        objectTitle: '',
      }))
    } else {
      setObjectId('')
      const fallback = (c.objects_note || c.address || '').trim()
      setRemont((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
      setDesign((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
      setAkt((f) => ({ ...f, city: c.city || f.city, objectAddress: fallback }))
      setSmeta((f) => ({
        ...f,
        city: c.city || f.city,
        objectAddress: fallback,
        objectTitle: '',
      }))
    }
  }

  function clearClient() {
    setClientId('')
    setObjectId('')
  }

  function pickObject(id: string) {
    setObjectId(id)
    if (!client || !id) return
    const obj = clientObjects.find((o) => o.id === id)
    if (obj) applyObjectToForms(obj, client.city || 'Москва', client.id)
  }

  const calcStages = useMemo(() => {
    const lines = calcTransfer.lines
    const seen: string[] = []
    for (const l of lines) {
      const s = (l.section || 'Прочее').trim() || 'Прочее'
      if (!seen.includes(s)) seen.push(s)
    }
    return seen
  }, [calcTransfer.lines])

  useEffect(() => {
    if (!clientId || !objectId) {
      setCalcVersions([])
      return
    }
    setCalcVersions(listCalcVersions(clientId, objectId))
  }, [clientId, objectId, versionMsg])

  useEffect(() => {
    if (kind !== 'akt') return
    const t = loadCalcTransfer()
    setCalcTransfer(t)
    if (t.lines.length === 0) return
    // по умолчанию — все строки выбранного этапа (первого раздела)
    const stages: string[] = []
    for (const l of t.lines) {
      const s = (l.section || 'Прочее').trim() || 'Прочее'
      if (!stages.includes(s)) stages.push(s)
    }
    const stage = stages[aktStageIdx] || stages[0] || 'Прочее'
    const sel: Record<number, boolean> = {}
    t.lines.forEach((l, i) => {
      const s = (l.section || 'Прочее').trim() || 'Прочее'
      sel[i] = s === stage
    })
    setAktSelected(sel)
    setAkt((f) => ({
      ...f,
      stageName: `Этап ${Math.min(aktStageIdx, stages.length - 1) + 1} — ${stage}`,
      lines: t.lines
        .filter((_, i) => sel[i])
        .map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
        })),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when tab/stage/calc changes
  }, [kind, aktStageIdx, calcTransfer.updatedAt])

  function applyAktSelection(lines: CalcSmetaLine[], selected: Record<number, boolean>, stageName: string) {
    setAkt((f) => ({
      ...f,
      stageName,
      lines: lines
        .filter((_, i) => selected[i])
        .map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
        })),
    }))
  }

  function refreshCalcVersions() {
    if (!clientId || !objectId) return
    setCalcVersions(listCalcVersions(clientId, objectId))
  }

  /** Подтянуть версию в договор ремонта + смету (по умолчанию после согласования). */
  function applyVersionToDocs(v: CalcVersion, switchTabs = true) {
    applyVersionToTransfer(v)
    setCalcTransfer({
      ...loadCalcTransfer(),
      transferToRemont: true,
      withDetails: true,
      total: v.total,
      baseTotal: v.baseTotal,
      discountPct: v.discountPct,
      lines: v.lines,
      updatedAt: v.updatedAt,
    })
    setRemont((f) => ({ ...f, totalSum: v.total }))
    setSmeta((f) => ({
      ...f,
      discountPct: v.discountPct,
      lines: v.lines.map((l) => ({
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        price: l.price,
        section: l.section || 'Прочее',
      })),
      fromCalc: true,
    }))
    if (switchTabs) {
      setKind('remont')
      setVersionMsg('Согласовано → договор и смета заполнены. Сгенерируйте оба документа.')
    }
  }

  /** Подтянуть сумму / детализацию из калькулятора в договор ремонт */
  function takeFromCalculator(mode: 'summary' | 'details') {
    const t = loadCalcTransfer()
    if (!t.total && t.lines.length === 0) {
      setMsg('В калькуляторе нет заполненных объёмов — сначала заполните смету')
      return
    }
    const next = {
      ...t,
      transferToRemont: true,
      withDetails: mode === 'details',
      updatedAt: new Date().toISOString(),
    }
    saveCalcTransfer(next)
    setCalcTransfer(next)
    setRemont((f) => ({ ...f, totalSum: next.total || f.totalSum }))
    setCalcMenuOpen(false)
    setMsg(
      mode === 'details'
        ? `Из калькулятора: ${formatMoney(next.total)} ₽ + детализация (${next.lines.length} строк)`
        : `Из калькулятора: общая сумма ${formatMoney(next.total)} ₽`,
    )
  }

  function clearCalculatorLink() {
    const t = loadCalcTransfer()
    const next = { ...t, transferToRemont: false, withDetails: false }
    saveCalcTransfer(next)
    setCalcTransfer(next)
    if (t.total > 0) {
      setRemont((f) => ({ ...f, totalSum: t.total }))
    }
    setCalcMenuOpen(false)
    setMsg('')
  }

  useEffect(() => {
    if (!calcMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!calcMenuRef.current?.contains(e.target as Node)) setCalcMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [calcMenuOpen])

  useEffect(() => {
    if (clientId && !filtered.some((c) => c.id === clientId)) {
      setClientId('')
      setObjectId('')
    }
  }, [filtered, clientId])

  // один объект у уже выбранного клиента — автовыбор
  useEffect(() => {
    if (!client) return
    if (clientObjects.length === 1 && objectId !== clientObjects[0].id) {
      setObjectId(clientObjects[0].id)
      applyObjectToForms(clientObjects[0], client.city || 'Москва')
    }
    if (clientObjects.length === 0 && objectId) {
      setObjectId('')
    }
    if (objectId && clientObjects.length > 0 && !clientObjects.some((o) => o.id === objectId)) {
      setObjectId('')
    }
  }, [client?.id, clientObjects.length])

  const designTotal = (design.areaM2 || 0) * DESIGN_RATE_PER_M2
  const aktTotal = akt.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)
  const aktRest = Math.max(0, aktTotal - (Number(akt.paid) || 0))
  const smetaBase = smeta.lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  )
  const smetaDiscount =
    Math.round(smetaBase * (Math.max(0, Math.min(100, smeta.discountPct)) / 100) * 100) / 100
  const smetaTotal = Math.round((smetaBase - smetaDiscount) * 100) / 100
  const cardGaps = client ? missingFromCard(client) : []

  async function onGenerate() {
    setMsg('')
    if (!client) {
      setMsg('Выберите клиента из поиска')
      return
    }
    setBusy(true)
    try {
      if (kind === 'remont') {
        if (!remont.objectAddress.trim()) throw new Error('Укажите адрес объекта')
        if (!executorName.trim()) throw new Error('Укажите ФИО исполнителя')

        const transfer = loadCalcTransfer()
        setCalcTransfer(transfer)
        let totalSum = remont.totalSum
        let smetaLines = undefined as
          | { name: string; unit: string; qty: number; price: number; section?: string }[]
          | undefined
        let discountPct = 0
        let baseTotal: number | undefined

        if (transfer.transferToRemont) {
          if (!transfer.total || transfer.lines.length === 0) {
            throw new Error(
              'В калькуляторе включён перенос в договор, но смета пуста — заполните объёмы или снимите галочку',
            )
          }
          totalSum = transfer.total
          discountPct = transfer.discountPct || 0
          baseTotal = transfer.baseTotal || transfer.total
          if (transfer.withDetails) {
            smetaLines = transfer.lines.map((l) => ({
              name: l.name,
              unit: l.unit,
              qty: l.qty,
              price: l.price,
              section: l.section,
            }))
          }
        } else if (!totalSum) {
          throw new Error('Укажите сумму договора или включите перенос из калькулятора')
        }

        await generateRemontDoc(client, {
          ...remont,
          areaM2: remont.areaM2,
          totalSum,
          discountPct,
          baseTotal,
          executorName,
          smetaLines,
        })
      } else if (kind === 'design') {
        if (!design.objectAddress.trim()) throw new Error('Укажите адрес объекта')
        if (!design.areaM2) throw new Error('Укажите площадь, м²')
        if (!executorName.trim()) throw new Error('Укажите ФИО исполнителя')
        await generateDesignDoc(client, { ...design, executorName })
      } else if (kind === 'akt') {
        if (!akt.objectAddress.trim()) throw new Error('Укажите адрес объекта')
        if (!akt.stageName.trim()) throw new Error('Укажите название этапа')
        if (!akt.lines.some((l) => l.name.trim() && l.price > 0)) {
          throw new Error('Добавьте хотя бы одну строку работ')
        }
        if (!executorName.trim()) throw new Error('Укажите ФИО исполнителя')
        await generateAktDoc(client, { ...akt, executorName })
      } else {
        if (!smeta.objectAddress.trim()) throw new Error('Укажите адрес объекта')
        if (!smeta.lines.some((l) => l.name.trim() && l.qty > 0 && l.price >= 0)) {
          throw new Error('Добавьте хотя бы одну строку работ или перенесите из калькулятора')
        }
        if (!executorName.trim()) throw new Error('Укажите ФИО исполнителя')
        await generateSmetaDoc(client, {
          number: smeta.number,
          date: smeta.date,
          city: smeta.city,
          objectAddress: smeta.objectAddress,
          objectTitle: smeta.objectTitle,
          areaM2: smeta.areaM2,
          workDays: smeta.workDays,
          discountPct: smeta.discountPct,
          rolledUp: smeta.rolledUp,
          lines: smeta.lines,
          executorName,
        })
      }
      setMsg('Документ скачан (.docx)')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка генерации')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: DocKind; label: string }[] = [
    { id: 'remont', label: 'Договор ремонт' },
    { id: 'design', label: 'Договор дизайн' },
    { id: 'akt', label: 'Акт работ' },
    { id: 'smeta', label: 'Смета' },
  ]

  const showClientList = q.trim().length > 0 || !client

  return (
    <div className="-mx-1 space-y-2 pb-20 sm:space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              className={inputCls}
              placeholder="Поиск по базе клиентов…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {showClientList && (
              <div>
                {!client && (
                  <p className="mb-1 text-[11px] font-medium text-amber-700">
                    Нажмите на клиента в списке — без этого договор не сформировать
                  </p>
                )}
                <div className="max-h-28 overflow-y-auto rounded-md border border-gray-200">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-gray-500">Никого не найдено</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filtered.slice(0, 8).map((c) => (
                        <li
                          key={c.id}
                          className={`flex items-center gap-2 px-2 py-1.5 text-sm ${
                            clientId === c.id ? 'bg-blue-50' : 'hover:bg-blue-50/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => pickClient(c)}
                            className="min-w-0 flex-1 truncate text-left font-medium text-gray-900"
                          >
                            {c.name || 'Без имени'}
                          </button>
                          <PhoneActions phone={c.mobile} showNumber size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          {client && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs sm:max-w-xs sm:justify-end">
              <span className="truncate font-medium text-emerald-900">{client.name}</span>
              <span className="rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-emerald-800">
                {client.fizurlico === 'ur' ? 'Юр' : 'Физ'}
              </span>
              <Link
                to={`/clients/${client.id}/main`}
                className="ml-auto font-medium text-blue-700 hover:underline sm:ml-0"
              >
                Карточка →
              </Link>
              <button
                type="button"
                className="text-emerald-800/70 hover:text-emerald-950"
                title="Сменить клиента"
                onClick={clearClient}
              >
                ×
              </button>
            </div>
          )}
        </div>
        {client && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            {clientObjects.length === 0 ? (
              <p className="text-[11px] text-amber-700">
                У клиента нет объектов — адрес заполните вручную или{' '}
                <Link
                  to={`/clients/${client.id}/main`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  добавьте объект в карточке →
                </Link>
              </p>
            ) : (
              <Field
                label="Объект"
                hint={
                  selectedObject
                    ? undefined
                    : clientObjects.length > 1
                      ? 'Выберите объект — подставятся адрес и номер договора'
                      : undefined
                }
              >
                <select
                  className={inputCls}
                  value={objectId}
                  onChange={(e) => pickObject(e.target.value)}
                >
                  {clientObjects.length > 1 && (
                    <option value="">Выберите объект…</option>
                  )}
                  {clientObjects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {objectLabel(o)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
        {client && cardGaps.length > 0 && (
          <p className="mt-1.5 truncate text-[11px] text-amber-700" title={cardGaps.join(', ')}>
            В КК не хватает: {cardGaps.join(', ')}
          </p>
        )}
        {client && objectId && (
          <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800">
                Версии расчёта
              </span>
              <button
                type="button"
                className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-40"
                onClick={() => {
                  const label = window.prompt(
                    'Название версии',
                    `Версия ${new Date().toLocaleString('ru-RU')}`,
                  )
                  if (label === null) return
                  saveCalcVersionFromTransfer({
                    clientId,
                    objectId,
                    label: label.trim() || undefined,
                  })
                  setVersionMsg('Версия сохранена со статусом «расчёт»')
                  refreshCalcVersions()
                }}
                disabled={!calcTransfer.lines.length && !calcTransfer.total}
              >
                Сохранить снимок
              </button>
              {getAgreedCalcVersion(clientId, objectId) && (
                <button
                  type="button"
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  onClick={() => {
                    const agreed = getAgreedCalcVersion(clientId, objectId)
                    if (!agreed) return
                    applyVersionToDocs(agreed, true)
                    setVersionMsg(
                      'Договор ремонта и смета заполнены из согласованной — сгенерируйте оба документа (вкладки)',
                    )
                  }}
                >
                  Договор + смета из согласованной
                </button>
              )}
              {versionMsg && (
                <span className="text-[11px] text-emerald-800">{versionMsg}</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Несколько версий на объект. Статус «расчёт» или «согласованный» (только одна).
              Из согласованной по умолчанию — договор ремонта и смета (не акт).
            </p>
            {calcVersions.length === 0 ? (
              <p className="mt-1 text-[11px] text-gray-400">
                Пока нет версий — заполните калькулятор и сохраните снимок.
              </p>
            ) : (
              <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs">
                {calcVersions.map((v) => (
                  <li
                    key={v.id}
                    className={`flex flex-wrap items-center gap-1.5 rounded border px-2 py-1 ${
                      v.agreed
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        v.agreed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {versionStatusLabel(v)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-900">
                      {v.label}
                    </span>
                    <span className="tabular-nums text-gray-600">
                      {formatMoney(v.total)} ₽
                      {v.discountPct > 0 ? ` (−${v.discountPct}%)` : ''}
                    </span>
                    <button
                      type="button"
                      className="text-blue-700 hover:underline"
                      title="Подставить в формы"
                      onClick={() => {
                        applyVersionToDocs(v, false)
                        setVersionMsg(`Загружена: ${v.label}`)
                      }}
                    >
                      Загрузить
                    </button>
                    {!v.agreed ? (
                      <button
                        type="button"
                        className="font-medium text-emerald-700 hover:underline"
                        onClick={() => {
                          const agreed = agreeCalcVersion(v.id)
                          refreshCalcVersions()
                          if (agreed) applyVersionToDocs(agreed, true)
                        }}
                      >
                        Согласовать
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-amber-800 hover:underline"
                        onClick={() => {
                          clearAgreedCalcVersion(clientId, objectId)
                          setVersionMsg('Согласование снято')
                          refreshCalcVersions()
                        }}
                      >
                        Снять
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-gray-500 hover:underline"
                      onClick={() => {
                        const next = window.prompt('Переименовать версию', v.label)
                        if (next === null) return
                        renameCalcVersion(v.id, next)
                        refreshCalcVersions()
                      }}
                    >
                      Имя
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 hover:underline"
                      onClick={() => {
                        if (!confirm('Удалить версию?')) return
                        deleteCalcVersion(v.id)
                        refreshCalcVersions()
                      }}
                    >
                      Удал.
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-0.5 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setKind(t.id)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-sm font-medium ${
              kind === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {kind === 'remont' && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Field label="Номер договора">
              <input
                className={inputCls}
                value={remont.number}
                onChange={(e) => setRemont({ ...remont, number: e.target.value })}
                placeholder="13"
              />
            </Field>
            <Field label="Дата договора">
              <input
                type="date"
                className={inputCls}
                value={remont.date}
                onChange={(e) => setRemont({ ...remont, date: e.target.value })}
              />
            </Field>
            <Field label="Город">
              <input
                className={inputCls}
                value={remont.city}
                onChange={(e) => setRemont({ ...remont, city: e.target.value })}
              />
            </Field>
            <Field label="Срок работ, раб. дней">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={remont.workDays || ''}
                onChange={(e) => setRemont({ ...remont, workDays: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Адрес объекта" className="col-span-2 lg:col-span-2">
              <AddressInput
                value={remont.objectAddress}
                onChange={(v) => setRemont({ ...remont, objectAddress: v })}
              />
            </Field>
            <Field label="Площадь, м²" hint="С объекта клиента">
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputCls}
                value={remont.areaM2 || ''}
                onChange={(e) => setRemont({ ...remont, areaM2: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field
              label="Сумма, ₽"
              className="col-span-2 lg:col-span-2"
              hint={
                calcTransfer.transferToRemont
                  ? `Из калькулятора${calcTransfer.withDetails ? ' + детализация' : ' (общая)'}${
                      calcTransfer.discountPct ? ` · −${calcTransfer.discountPct}%` : ''
                    }`
                  : remont.totalSum
                    ? rublesInWords(remont.totalSum)
                    : 'Кнопка справа — взять данные из калькулятора'
              }
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${inputCls} h-9 min-w-0 flex-1`}
                  value={
                    calcTransfer.transferToRemont ? calcTransfer.total || '' : remont.totalSum || ''
                  }
                  readOnly={calcTransfer.transferToRemont}
                  onChange={(e) => setRemont({ ...remont, totalSum: Number(e.target.value) || 0 })}
                />
                <div className="relative shrink-0" ref={calcMenuRef}>
                  <button
                    type="button"
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md border shadow-sm ${
                      calcTransfer.transferToRemont
                        ? 'border-violet-300 bg-violet-50 text-violet-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'
                    }`}
                    title="Взять данные из калькулятора"
                    aria-label="Взять данные из калькулятора"
                    aria-expanded={calcMenuOpen}
                    onClick={() => setCalcMenuOpen((o) => !o)}
                  >
                    <RiCalculatorFill className="h-4 w-4" aria-hidden />
                  </button>
                  {calcMenuOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
                      <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Из калькулятора
                      </p>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-gray-800 hover:bg-violet-50"
                        onClick={() => {
                          takeFromCalculator('summary')
                          setCalcMenuOpen(false)
                        }}
                      >
                        Общая информация
                        <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                          Сумма и скидка без строк сметы
                        </span>
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-gray-800 hover:bg-violet-50"
                        onClick={() => {
                          takeFromCalculator('details')
                          setCalcMenuOpen(false)
                        }}
                      >
                        С детализированной сметой
                        <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                          Сумма + приложение со строками
                        </span>
                      </button>
                      {calcTransfer.transferToRemont && (
                        <>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-gray-500 hover:bg-gray-50"
                            onClick={clearCalculatorLink}
                          >
                            Отвязать калькулятор
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Field>
          </div>
        </div>
      )}

      {kind === 'design' && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Field label="Номер договора">
              <input
                className={inputCls}
                value={design.number}
                onChange={(e) => setDesign({ ...design, number: e.target.value })}
              />
            </Field>
            <Field label="Дата договора">
              <input
                type="date"
                className={inputCls}
                value={design.date}
                onChange={(e) => setDesign({ ...design, date: e.target.value })}
              />
            </Field>
            <Field label="Город">
              <input
                className={inputCls}
                value={design.city}
                onChange={(e) => setDesign({ ...design, city: e.target.value })}
              />
            </Field>
            <Field label="Площадь, м²">
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputCls}
                value={design.areaM2 || ''}
                onChange={(e) => setDesign({ ...design, areaM2: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Адрес объекта" className="col-span-2">
              <AddressInput
                value={design.objectAddress}
                onChange={(v) => setDesign({ ...design, objectAddress: v })}
              />
            </Field>
            <Field label="Итого" className="col-span-2">
              <div
                className={`${inputCls} flex items-center gap-1 bg-gray-50 text-gray-700`}
              >
                <span className="font-semibold tabular-nums">{formatMoney(designTotal)} ₽</span>
                <span className="text-xs text-gray-400">
                  · 4× {formatMoney(designTotal / 4)}
                </span>
              </div>
            </Field>
          </div>
        </div>
      )}

      {kind === 'akt' && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Field label="Номер акта">
              <input
                className={inputCls}
                value={akt.number}
                onChange={(e) => setAkt({ ...akt, number: e.target.value })}
              />
            </Field>
            <Field label="Дата акта">
              <input
                type="date"
                className={inputCls}
                value={akt.date}
                onChange={(e) => setAkt({ ...akt, date: e.target.value })}
              />
            </Field>
            <Field label="Город">
              <input
                className={inputCls}
                value={akt.city}
                onChange={(e) => setAkt({ ...akt, city: e.target.value })}
              />
            </Field>
            <Field
              label="Этап договора"
              hint={
                calcStages.length
                  ? 'Нумерация по разделам калькулятора / договора'
                  : 'Сначала перенесите смету из калькулятора'
              }
            >
              {calcStages.length > 0 ? (
                <select
                  className={inputCls}
                  value={aktStageIdx}
                  onChange={(e) => setAktStageIdx(Number(e.target.value) || 0)}
                >
                  {calcStages.map((s, i) => (
                    <option key={s} value={i}>
                      Этап {i + 1} — {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  value={akt.stageName}
                  onChange={(e) => setAkt({ ...akt, stageName: e.target.value })}
                  placeholder="Монтаж…"
                />
              )}
            </Field>
            <Field label="Название этапа (в акте)" className="col-span-2 lg:col-span-2">
              <input
                className={inputCls}
                value={akt.stageName}
                onChange={(e) => setAkt({ ...akt, stageName: e.target.value })}
                placeholder="Этап 1 — …"
              />
            </Field>
            <Field label="Адрес объекта" className="col-span-2 lg:col-span-2">
              <AddressInput
                value={akt.objectAddress}
                onChange={(v) => setAkt({ ...akt, objectAddress: v })}
              />
            </Field>
          </div>

          {calcTransfer.lines.length > 0 && (
            <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/60 p-2">
              <p className="mb-1.5 text-[11px] font-medium text-violet-800">
                Работы из калькулятора — отметьте, что входит в этот акт
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {calcTransfer.lines.map((l, i) => {
                  const section = (l.section || 'Прочее').trim() || 'Прочее'
                  return (
                    <li key={`${l.name}-${i}`} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(aktSelected[i])}
                        onChange={(e) => {
                          const next = { ...aktSelected, [i]: e.target.checked }
                          setAktSelected(next)
                          const stage =
                            calcStages[aktStageIdx] ||
                            calcStages[0] ||
                            section
                          applyAktSelection(
                            calcTransfer.lines,
                            next,
                            akt.stageName ||
                              `Этап ${aktStageIdx + 1} — ${stage}`,
                          )
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900">{l.name}</span>
                        <span className="ml-1 text-[11px] text-gray-500">
                          · {section} · {l.qty} {l.unit} × {formatMoney(l.price)}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-violet-800 hover:underline"
                  onClick={() => {
                    const stage = calcStages[aktStageIdx] || calcStages[0]
                    const next: Record<number, boolean> = {}
                    calcTransfer.lines.forEach((l, i) => {
                      const s = (l.section || 'Прочее').trim() || 'Прочее'
                      next[i] = s === stage
                    })
                    setAktSelected(next)
                    applyAktSelection(
                      calcTransfer.lines,
                      next,
                      `Этап ${aktStageIdx + 1} — ${stage}`,
                    )
                  }}
                >
                  Только этот этап
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-violet-800 hover:underline"
                  onClick={() => {
                    const next: Record<number, boolean> = {}
                    calcTransfer.lines.forEach((_, i) => {
                      next[i] = true
                    })
                    setAktSelected(next)
                    applyAktSelection(calcTransfer.lines, next, akt.stageName)
                  }}
                >
                  Выбрать все
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 max-h-36 overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-1">Работа</th>
                  <th className="px-2 py-1">Ед.</th>
                  <th className="px-2 py-1">Кол.</th>
                  <th className="px-2 py-1">Цена</th>
                  <th className="px-2 py-1">Σ</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {akt.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="min-w-[140px] px-1 py-1">
                      <input
                        className={inputCls}
                        value={l.name}
                        onChange={(e) => {
                          const lines = [...akt.lines]
                          lines[i] = { ...l, name: e.target.value }
                          setAkt({ ...akt, lines })
                        }}
                      />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <input
                        className={inputCls}
                        value={l.unit}
                        onChange={(e) => {
                          const lines = [...akt.lines]
                          lines[i] = { ...l, unit: e.target.value }
                          setAkt({ ...akt, lines })
                        }}
                      />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <input
                        type="number"
                        className={inputCls}
                        value={l.qty || ''}
                        onChange={(e) => {
                          const lines = [...akt.lines]
                          lines[i] = { ...l, qty: Number(e.target.value) || 0 }
                          setAkt({ ...akt, lines })
                        }}
                      />
                    </td>
                    <td className="w-20 px-1 py-1">
                      <input
                        type="number"
                        className={inputCls}
                        value={l.price || ''}
                        onChange={(e) => {
                          const lines = [...akt.lines]
                          lines[i] = { ...l, price: Number(e.target.value) || 0 }
                          setAkt({ ...akt, lines })
                        }}
                      />
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-xs tabular-nums text-gray-800">
                      {formatMoney(l.qty * l.price)}
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() =>
                          setAkt({ ...akt, lines: akt.lines.filter((_, j) => j !== i) })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-blue-700 hover:underline"
              onClick={() =>
                setAkt({
                  ...akt,
                  lines: [...akt.lines, { name: '', unit: 'ед.', qty: 1, price: 0 }],
                })
              }
            >
              + Строка
            </button>
            <Field label="Оплачено" className="w-28">
              <input
                type="number"
                className={inputCls}
                value={akt.paid || ''}
                onChange={(e) => setAkt({ ...akt, paid: Number(e.target.value) || 0 })}
              />
            </Field>
            <span className="text-xs text-gray-600">
              Итого <b>{formatMoney(aktTotal)}</b> · остаток <b>{formatMoney(aktRest)}</b>
            </span>
          </div>
        </div>
      )}

      {kind === 'smeta' && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Field label="Номер сметы">
              <input
                className={inputCls}
                value={smeta.number}
                onChange={(e) => setSmeta({ ...smeta, number: e.target.value })}
                placeholder="13297"
              />
            </Field>
            <Field label="Дата">
              <input
                type="date"
                className={inputCls}
                value={smeta.date}
                onChange={(e) => setSmeta({ ...smeta, date: e.target.value })}
              />
            </Field>
            <Field label="Город">
              <input
                className={inputCls}
                value={smeta.city}
                onChange={(e) => setSmeta({ ...smeta, city: e.target.value })}
              />
            </Field>
            <Field label="Срок, раб. дней">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={smeta.workDays || ''}
                onChange={(e) => setSmeta({ ...smeta, workDays: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Объект (название)" className="col-span-2">
              <input
                className={inputCls}
                value={smeta.objectTitle}
                onChange={(e) => setSmeta({ ...smeta, objectTitle: e.target.value })}
                placeholder="ЖК Sky Garden"
              />
            </Field>
            <Field label="Площадь, м²">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={smeta.areaM2 || ''}
                onChange={(e) => setSmeta({ ...smeta, areaM2: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Скидка, %">
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                className={inputCls}
                value={smeta.discountPct || ''}
                onChange={(e) => setSmeta({ ...smeta, discountPct: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Адрес объекта" className="col-span-2 lg:col-span-3">
              <AddressInput
                value={smeta.objectAddress}
                onChange={(v) => setSmeta({ ...smeta, objectAddress: v })}
              />
            </Field>
            <label className="flex items-end gap-2 pb-1 text-xs text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={smeta.rolledUp}
                onChange={(e) => setSmeta({ ...smeta, rolledUp: e.target.checked })}
              />
              Только итоги по разделам
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            {smeta.fromCalc ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                Строки из калькулятора ({smeta.lines.length})
              </span>
            ) : (
              <span>Заполните строки вручную или откройте калькулятор с объёмами</span>
            )}
            <button
              type="button"
              className="font-medium text-blue-700 hover:underline"
              onClick={() => {
                const t = loadCalcTransfer()
                setCalcTransfer(t)
                if (!t.lines.length) {
                  setMsg('В калькуляторе нет заполненных объёмов')
                  return
                }
                setSmeta((f) => ({
                  ...f,
                  discountPct: t.discountPct || 0,
                  lines: t.lines.map((l) => ({
                    name: l.name,
                    unit: l.unit,
                    qty: l.qty,
                    price: l.price,
                    section: l.section || 'Прочее',
                  })),
                  fromCalc: true,
                }))
                setMsg('')
              }}
            >
              Обновить из калькулятора
            </button>
          </div>

          <div className="mt-2 max-h-48 overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-1">Раздел</th>
                  <th className="px-2 py-1">Работа</th>
                  <th className="px-2 py-1">Ед.</th>
                  <th className="px-2 py-1">Кол.</th>
                  <th className="px-2 py-1">Цена</th>
                  <th className="px-2 py-1">Σ</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {smeta.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="w-28 px-1 py-1">
                      <input
                        className={inputCls}
                        value={l.section || ''}
                        onChange={(e) => {
                          const lines = [...smeta.lines]
                          lines[i] = { ...l, section: e.target.value }
                          setSmeta({ ...smeta, lines, fromCalc: false })
                        }}
                      />
                    </td>
                    <td className="min-w-[140px] px-1 py-1">
                      <input
                        className={inputCls}
                        value={l.name}
                        onChange={(e) => {
                          const lines = [...smeta.lines]
                          lines[i] = { ...l, name: e.target.value }
                          setSmeta({ ...smeta, lines, fromCalc: false })
                        }}
                      />
                    </td>
                    <td className="w-14 px-1 py-1">
                      <input
                        className={inputCls}
                        value={l.unit}
                        onChange={(e) => {
                          const lines = [...smeta.lines]
                          lines[i] = { ...l, unit: e.target.value }
                          setSmeta({ ...smeta, lines, fromCalc: false })
                        }}
                      />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <input
                        type="number"
                        className={inputCls}
                        value={l.qty || ''}
                        onChange={(e) => {
                          const lines = [...smeta.lines]
                          lines[i] = { ...l, qty: Number(e.target.value) || 0 }
                          setSmeta({ ...smeta, lines, fromCalc: false })
                        }}
                      />
                    </td>
                    <td className="w-20 px-1 py-1">
                      <input
                        type="number"
                        className={inputCls}
                        value={l.price || ''}
                        onChange={(e) => {
                          const lines = [...smeta.lines]
                          lines[i] = { ...l, price: Number(e.target.value) || 0 }
                          setSmeta({ ...smeta, lines, fromCalc: false })
                        }}
                      />
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-xs tabular-nums text-gray-800">
                      {formatMoney(l.qty * l.price)}
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() =>
                          setSmeta({
                            ...smeta,
                            lines: smeta.lines.filter((_, j) => j !== i),
                            fromCalc: false,
                          })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-blue-700 hover:underline"
              onClick={() =>
                setSmeta({
                  ...smeta,
                  lines: [
                    ...smeta.lines,
                    { name: '', unit: 'ед.', qty: 1, price: 0, section: 'Прочее' },
                  ],
                  fromCalc: false,
                })
              }
            >
              + Строка
            </button>
            <span className="text-xs text-gray-600">
              База <b>{formatMoney(smetaBase)}</b>
              {smeta.discountPct > 0 && (
                <>
                  {' '}
                  · скидка <b>−{formatMoney(smetaDiscount)}</b>
                </>
              )}{' '}
              · итого <b>{formatMoney(smetaTotal)}</b>
            </span>
          </div>
        </div>
      )}

      {/* Липкая панель: исполнитель + сформировать — всегда на экране */}
      <div
        data-sticky-footer
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 pr-16 sm:flex-row sm:items-end sm:gap-4 sm:px-6 sm:pr-20 lg:px-8 lg:pr-20">
          <Field label="ФИО Исполнителя" className="min-w-0 flex-1">
            <input
              className={inputCls}
              value={executorName}
              onChange={(e) => setExecutorName(e.target.value)}
              placeholder="Ротарь Даниил Сергеевич"
            />
          </Field>
          <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
            {(msg || !client) && (
              <p
                className={`text-xs ${
                  msg.includes('скачан')
                    ? 'text-emerald-700'
                    : !client
                      ? 'text-amber-700'
                      : 'text-red-600'
                }`}
              >
                {msg || 'Выберите клиента в списке выше'}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onGenerate()}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Формируем…' : 'Сформировать и скачать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

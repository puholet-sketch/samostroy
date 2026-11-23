import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  agreeCalcVersion,
  getCalcVersion,
  listCalcVersions,
  saveCalcVersionFromTransfer,
  versionStatusLabel,
  type CalcVersion,
} from '../../lib/calcVersions'
import { loadCalcTransfer } from '../../lib/calcTransfer'
import { loadClients } from '../../lib/clients'
import { CONTRACTOR } from '../../lib/contractor'
import {
  getIssuedDoc,
  listAgreedRepairContracts,
  nextActStageNumber,
  upsertIssuedDoc,
  type IssuedDoc,
} from '../../lib/docRegistry'
import { generateAktDoc } from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import CalculatorPanel from '../calculator/CalculatorPanel'
import {
  Field,
  WizardShell,
  inputCls,
  todayIso,
} from './docUi'

export default function ActsWizardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const docIdParam = searchParams.get('docId') || ''
  const hydratedRef = useRef('')
  const [contracts, setContracts] = useState<IssuedDoc[]>([])
  const [contractId, setContractId] = useState('')
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [date, setDate] = useState(todayIso)
  const [paid, setPaid] = useState(0)
  const [stageName, setStageName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editDocId, setEditDocId] = useState('')
  const [lockedStage, setLockedStage] = useState<number | null>(null)
  const [versions, setVersions] = useState<CalcVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [calcTick, setCalcTick] = useState(0)

  useEffect(() => {
    document.title = 'Акты — СамоСтрой'
    setContracts(listAgreedRepairContracts())
  }, [])

  useEffect(() => {
    if (!docIdParam || hydratedRef.current === docIdParam) return
    const doc = getIssuedDoc(docIdParam)
    if (!doc || doc.kind !== 'act') return
    hydratedRef.current = docIdParam
    setEditDocId(doc.id)
    setLockedStage(doc.actStageNumber ?? null)
    setContractId(doc.parentContractId || '')
    setStageName(doc.stageName || `Этап ${doc.actStageNumber ?? ''}`)
    if (doc.docDate) setDate(doc.docDate)
    if (doc.paid != null) setPaid(doc.paid)
    setMsg(`Редактирование акта · этап ${doc.actStageNumber ?? '—'}`)
    setSearchParams({ docId: doc.id }, { replace: true })
  }, [docIdParam])

  const contract = contracts.find((c) => c.id === contractId) ?? null
  const clients = useMemo(() => loadClients(), [])
  const client = contract ? clients.find((c) => c.id === contract.clientId) : null

  useEffect(() => {
    if (!contract?.clientId || !contract.objectId) {
      setVersions([])
      return
    }
    setVersions(listCalcVersions(contract.clientId, contract.objectId))
  }, [contract?.id, contract?.clientId, contract?.objectId, calcTick, msg])

  useEffect(() => {
    if (!contract) return
    if (contract.calcVersionId) setVersionId(contract.calcVersionId)
  }, [contractId])

  const activeVersion =
    versions.find((v) => v.id === versionId) ||
    (contract?.calcVersionId ? getCalcVersion(contract.calcVersionId) : undefined) ||
    versions.find((v) => v.agreed)

  const lines = activeVersion?.lines ?? []

  const sections = useMemo(() => {
    const seen: string[] = []
    for (const l of lines) {
      const s = (l.section || 'Прочее').trim() || 'Прочее'
      if (!seen.includes(s)) seen.push(s)
    }
    return seen
  }, [lines])

  useEffect(() => {
    if (!contract) return
    if (editDocId && hydratedRef.current) {
      const doc = getIssuedDoc(editDocId)
      if (doc?.actLines?.length && lines.length) {
        const sel: Record<number, boolean> = {}
        lines.forEach((l, i) => {
          sel[i] = doc.actLines!.some(
            (a) => a.name === l.name && a.qty === l.qty && a.price === l.price,
          )
        })
        setSelected(sel)
        return
      }
    }
    if (!editDocId) {
      const n = nextActStageNumber(contract.id)
      setStageName(`Этап ${n}`)
    }
    const sel: Record<number, boolean> = {}
    lines.forEach((_, i) => {
      sel[i] = false
    })
    setSelected(sel)
  }, [contractId, lines.length, editDocId])

  const picked = lines.filter((_, i) => selected[i])
  const aktTotal = picked.reduce((s, l) => s + l.qty * l.price, 0)
  const groupedPreview = useMemo(() => {
    const map = new Map<string, typeof picked>()
    for (const l of picked) {
      const sec = (l.section || 'Прочее').trim() || 'Прочее'
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(l)
    }
    return [...map.entries()]
  }, [picked])

  const transfer = useMemo(() => loadCalcTransfer(), [calcTick])
  const editing = Boolean(editDocId && lockedStage != null)

  function toggleSection(sec: string, on: boolean) {
    setSelected((prev) => {
      const next = { ...prev }
      lines.forEach((l, i) => {
        const s = (l.section || 'Прочее').trim() || 'Прочее'
        if (s === sec) next[i] = on
      })
      return next
    })
  }

  function saveCurrentAsVersion() {
    if (!contract) {
      setMsg('Сначала выберите договор')
      return
    }
    const t = loadCalcTransfer()
    if (!t.lines.length) {
      setMsg('В калькуляторе нет строк — заполните объёмы')
      return
    }
    const v = saveCalcVersionFromTransfer({
      clientId: contract.clientId,
      objectId: contract.objectId,
    })
    setVersionId(v.id)
    setCalcTick((x) => x + 1)
    setMsg(`Сохранена версия сметы «${v.label}»`)
  }

  function markAgreed() {
    const id = versionId || activeVersion?.id
    if (!id) {
      setMsg('Сохраните или выберите версию сметы')
      return
    }
    const v = agreeCalcVersion(id)
    if (!v) {
      setMsg('Не удалось согласовать')
      return
    }
    setVersionId(v.id)
    setCalcTick((x) => x + 1)
    setMsg('Смета согласована — отметьте строки для акта')
  }

  async function issue() {
    setMsg('')
    if (!contract || !client) {
      setMsg('Выберите согласованный договор')
      return
    }
    if (!picked.length) {
      setMsg('Отметьте работы из согласованной сметы')
      return
    }
    setBusy(true)
    try {
      const stageNo = lockedStage ?? nextActStageNumber(contract.id)
      const number = String(stageNo)
      await generateAktDoc(client, {
        number,
        date,
        city: contract.city || client.city || 'Москва',
        objectAddress: contract.objectAddress || '',
        stageName: stageName || `Этап ${stageNo}`,
        paid,
        executorName: CONTRACTOR.name,
        contractNumber: contract.contractNumber,
        lines: picked.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section || 'Прочее',
        })),
      })
      upsertIssuedDoc({
        id: editDocId || undefined,
        kind: 'act',
        actStageNumber: stageNo,
        contractNumber: contract.contractNumber,
        parentContractId: contract.id,
        clientId: contract.clientId,
        objectId: contract.objectId,
        title: stageName || `Акт этап ${stageNo}`,
        status: 'issued',
        total: aktTotal,
        objectAddress: contract.objectAddress,
        city: contract.city,
        stageName: stageName || `Этап ${stageNo}`,
        docDate: date,
        paid,
        actLines: picked.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section,
        })),
      })
      setContracts(listAgreedRepairContracts())
      setLockedStage(stageNo)
      setMsg(
        editing
          ? `Акт этап ${stageNo} обновлён (тот же номер), PDF скачан`
          : `Акт № ${number} (этап ${stageNo}) скачан и записан`,
      )
      if (!editing) setSelected({})
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WizardShell
      title={
        editing ? `Акт · этап ${lockedStage}` : 'Акты выполненных работ'
      }
      footer={
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={busy || !contract || !picked.length}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
            onClick={() => void issue()}
          >
            {busy
              ? 'Формируем…'
              : editing
                ? 'Сохранить и скачать PDF'
                : 'Выпустить акт (PDF)'}
          </button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      }
    >
      {editing && (
        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Редактирование записи реестра. Номер этапа{' '}
          <strong>{lockedStage}</strong> сохранится.
        </p>
      )}

      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <Field label="Согласованный договор ремонта">
            {contracts.length === 0 ? (
              <p className="text-sm text-amber-700">
                Нет согласованных договоров.{' '}
                <Link to="/documents/repair" className="underline">
                  Выпустить договор ремонта
                </Link>
              </p>
            ) : (
              <select
                className={inputCls}
                value={contractId}
                disabled={editing}
                onChange={(e) => setContractId(e.target.value)}
              >
                <option value="">Выберите…</option>
                {contracts.map((c) => {
                  const name = clients.find((x) => x.id === c.clientId)?.name || c.clientId
                  return (
                    <option key={c.id} value={c.id}>
                      № {c.contractNumber} · {name} · {c.objectAddress || 'объект'}
                    </option>
                  )
                })}
              </select>
            )}
          </Field>
          {contract && (
            <p className="mt-2 text-xs text-gray-500">
              {editing
                ? `Этап акта: ${lockedStage}`
                : `Следующий номер акта по этапам: ${nextActStageNumber(contract.id)}`}{' '}
              · строки из сметы ({lines.length})
            </p>
          )}
        </div>

        {contract && (
          <div className="space-y-3">
            <CalculatorPanel
              embedded
              compact
              onChange={() => setCalcTick((x) => x + 1)}
            />
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 px-2.5 text-xs font-medium"
                onClick={saveCurrentAsVersion}
              >
                Сохранить расчёт как версию
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-900"
                onClick={markAgreed}
              >
                Пометить согласованной
              </button>
              <p className="text-xs text-gray-500 sm:col-span-2">
                Буфер: {transfer.lines.length} строк · {formatMoney(transfer.total)} ₽.
                Ниже отметьте строки для акта из выбранной версии сметы.
              </p>
              {versions.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 sm:col-span-2">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm hover:bg-gray-50">
                        <input
                          type="radio"
                          name="act-ver"
                          checked={versionId === v.id || (!versionId && v.agreed)}
                          onChange={() => setVersionId(v.id)}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {v.label}
                        </span>
                        <span className="text-gray-600">
                          {formatMoney(v.total)} ₽
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] ${
                            v.agreed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {versionStatusLabel(v)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {contract && lines.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap gap-2">
              {sections.map((sec) => {
                const idxs = lines
                  .map((l, i) => ({ l, i }))
                  .filter(({ l }) => ((l.section || 'Прочее').trim() || 'Прочее') === sec)
                const allOn = idxs.every(({ i }) => selected[i])
                return (
                  <button
                    key={sec}
                    type="button"
                    className={`rounded-md border px-2 py-1 text-xs ${
                      allOn
                        ? 'border-blue-400 bg-blue-50 text-blue-900'
                        : 'border-gray-200 text-gray-700'
                    }`}
                    onClick={() => toggleSection(sec, !allOn)}
                  >
                    {sec}
                  </button>
                )
              })}
            </div>
            <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-100 text-sm">
              {lines.map((l, i) => (
                <li key={`${l.name}-${i}`}>
                  <label className="flex cursor-pointer items-start gap-2 px-2 py-1.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selected[i])}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [i]: e.target.checked }))
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-gray-400">
                        {l.section || 'Прочее'}
                      </span>
                      <span className="font-medium text-gray-900">{l.name}</span>
                    </span>
                    <span className="shrink-0 text-gray-600">
                      {formatMoney(l.qty * l.price)} ₽
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {picked.length > 0 && (
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-2">
            <Field label="Название этапа в акте">
              <input
                className={inputCls}
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
              />
            </Field>
            <Field label="Дата акта">
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Оплачено, ₽">
              <input
                type="number"
                className={inputCls}
                value={paid || ''}
                onChange={(e) => setPaid(Number(e.target.value) || 0)}
              />
            </Field>
            <div className="text-sm text-gray-700 sm:col-span-2">
              <p>
                Итого по акту: <strong>{formatMoney(aktTotal)} ₽</strong>
              </p>
              <p className="mt-1 text-xs text-gray-500">Группировка в PDF по типам работ:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
                {groupedPreview.map(([sec, rows]) => (
                  <li key={sec}>
                    {sec}: {rows.length} поз. ·{' '}
                    {formatMoney(rows.reduce((s, l) => s + l.qty * l.price, 0))} ₽
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  )
}

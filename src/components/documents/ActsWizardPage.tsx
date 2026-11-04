import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCalcVersion } from '../../lib/calcVersions'
import { loadClients } from '../../lib/clients'
import { CONTRACTOR } from '../../lib/contractor'
import {
  listAgreedRepairContracts,
  nextActStageNumber,
  upsertIssuedDoc,
  type IssuedDoc,
} from '../../lib/docRegistry'
import { generateAktDoc } from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import {
  Field,
  WizardShell,
  inputCls,
  todayIso,
} from './docUi'

export default function ActsWizardPage() {
  const [contracts, setContracts] = useState<IssuedDoc[]>([])
  const [contractId, setContractId] = useState('')
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [date, setDate] = useState(todayIso)
  const [paid, setPaid] = useState(0)
  const [stageName, setStageName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    document.title = 'Акты — СамоСтрой'
    setContracts(listAgreedRepairContracts())
  }, [])

  const contract = contracts.find((c) => c.id === contractId) ?? null
  const clients = useMemo(() => loadClients(), [])
  const client = contract ? clients.find((c) => c.id === contract.clientId) : null
  const version = contract?.calcVersionId
    ? getCalcVersion(contract.calcVersionId)
    : undefined
  const lines = version?.lines ?? []

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
    const n = nextActStageNumber(contract.id)
    setStageName(`Этап ${n}`)
    const sel: Record<number, boolean> = {}
    lines.forEach((_, i) => {
      sel[i] = false
    })
    setSelected(sel)
  }, [contractId])

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
      const stageNo = nextActStageNumber(contract.id)
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
        actLines: picked.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section,
        })),
      })
      setContracts(listAgreedRepairContracts())
      setMsg(`Акт № ${number} (этап ${stageNo}) скачан и записан`)
      setSelected({})
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WizardShell
      title="Акты выполненных работ"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !contract || !picked.length}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void issue()}
          >
            {busy ? 'Формируем…' : 'Выпустить акт'}
          </button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      }
    >
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
              Следующий номер акта по этапам:{' '}
              <strong>{nextActStageNumber(contract.id)}</strong> · строки только из
              согласованной сметы ({lines.length})
            </p>
          )}
        </div>

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
              <p className="mt-1 text-xs text-gray-500">Группировка в DOCX по типам работ:</p>
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

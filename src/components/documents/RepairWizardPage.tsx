import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  agreeCalcVersion,
  listCalcVersions,
  saveCalcVersionFromTransfer,
  versionStatusLabel,
  type CalcVersion,
} from '../../lib/calcVersions'
import { loadCalcTransfer } from '../../lib/calcTransfer'
import { loadClients, saveClients } from '../../lib/clients'
import { CONTRACTOR } from '../../lib/contractor'
import {
  allocateContractNumber,
  getIssuedDoc,
  listIssuedDocs,
  upsertIssuedDoc,
  updateIssuedDoc,
} from '../../lib/docRegistry'
import {
  generateRemontDoc,
  generateSmetaDoc,
  generateTzStubDoc,
} from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import CalculatorPanel from '../calculator/CalculatorPanel'
import {
  ClientObjectPicker,
  Field,
  WizardShell,
  inputCls,
  todayIso,
  useClientObjectPicker,
} from './docUi'

export default function RepairWizardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const docIdParam = searchParams.get('docId') || ''
  const hydratedRef = useRef('')
  const picker = useClientObjectPicker(
    searchParams.get('clientId') || '',
    searchParams.get('objectId') || '',
  )
  const [step, setStep] = useState(1)
  const [date, setDate] = useState(todayIso)
  const [city, setCity] = useState('Москва')
  const [workDays, setWorkDays] = useState(80)
  const [plannedStart, setPlannedStart] = useState('')
  const [versions, setVersions] = useState<CalcVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [contractId, setContractId] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [editDocId, setEditDocId] = useState(docIdParam)
  const [lockedNumber, setLockedNumber] = useState('')
  const [tzDocId, setTzDocId] = useState('')
  const [smetaDocId, setSmetaDocId] = useState('')

  useEffect(() => {
    document.title = 'Договор ремонта — СамоСтрой'
  }, [])

  useEffect(() => {
    if (!docIdParam || hydratedRef.current === docIdParam) return
    let doc = getIssuedDoc(docIdParam)
    if (!doc) return
    // smeta/tz → open parent repair
    if ((doc.kind === 'smeta' || doc.kind === 'tz') && doc.parentContractId) {
      const parent = getIssuedDoc(doc.parentContractId)
      if (parent) doc = parent
    }
    if (doc.kind !== 'repair') return
    hydratedRef.current = docIdParam
    setEditDocId(doc.id)
    setLockedNumber(doc.contractNumber || '')
    setContractId(doc.id)
    setContractNumber(doc.contractNumber || '')
    picker.hydrate(doc.clientId, doc.objectId)
    if (doc.docDate) setDate(doc.docDate)
    if (doc.city) setCity(doc.city)
    if (doc.workDays) setWorkDays(doc.workDays)
    if (doc.plannedStartDate) setPlannedStart(doc.plannedStartDate)
    if (doc.calcVersionId) setVersionId(doc.calcVersionId)
    const children = listIssuedDocs().filter((d) => d.parentContractId === doc!.id)
    setTzDocId(children.find((d) => d.kind === 'tz')?.id || '')
    setSmetaDocId(children.find((d) => d.kind === 'smeta')?.id || '')
    setStep(1)
    setMsg(`Редактирование договора № ${doc.contractNumber || '—'}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docIdParam])

  useEffect(() => {
    if (picker.client?.city && !editDocId) setCity(picker.client.city)
    if (picker.selectedObject?.startDate && !plannedStart) {
      setPlannedStart(picker.selectedObject.startDate)
    }
  }, [picker.client?.id, picker.selectedObject?.id])

  useEffect(() => {
    if (!picker.clientId || !picker.objectId) {
      setVersions([])
      return
    }
    setVersions(listCalcVersions(picker.clientId, picker.objectId))
  }, [picker.clientId, picker.objectId, msg])

  useEffect(() => {
    if (step >= 4) return
    const next = new URLSearchParams()
    if (editDocId) next.set('docId', editDocId)
    if (picker.clientId) next.set('clientId', picker.clientId)
    if (picker.objectId) next.set('objectId', picker.objectId)
    const cur = searchParams.toString()
    const want = next.toString()
    if (cur !== want) setSearchParams(next, { replace: true })
  }, [picker.clientId, picker.objectId, editDocId, step])

  const transfer = useMemo(() => loadCalcTransfer(), [step, msg])
  const activeVersion = versions.find((v) => v.id === versionId)
  const agreed = versions.find((v) => v.agreed)
  const editing = Boolean(editDocId && lockedNumber)

  function refreshVersions() {
    if (!picker.clientId || !picker.objectId) return
    setVersions(listCalcVersions(picker.clientId, picker.objectId))
  }

  function saveCurrentAsVersion() {
    if (!picker.clientId || !picker.objectId) {
      setMsg('Сначала клиент и объект')
      return
    }
    const t = loadCalcTransfer()
    if (!t.lines.length) {
      setMsg('В калькуляторе нет строк — заполните смету в калькуляторе')
      return
    }
    const v = saveCalcVersionFromTransfer({
      clientId: picker.clientId,
      objectId: picker.objectId,
    })
    setVersionId(v.id)
    refreshVersions()
    setMsg(`Сохранена версия сметы «${v.label}»`)
  }

  function markAgreed() {
    const id = versionId || agreed?.id
    if (!id) {
      setMsg('Сохраните или выберите версию сметы')
      return
    }
    const v = agreeCalcVersion(id)
    if (!v) {
      setMsg('Не удалось согласовать')
      return
    }
    refreshVersions()
    setVersionId(v.id)
    setMsg('Смета согласована')
  }

  async function issueContract() {
    setMsg('')
    if (!picker.client || !picker.selectedObject) {
      setMsg('Выберите клиента и объект')
      return
    }
    const ver = versions.find((v) => v.id === versionId) || agreed
    if (!ver || !ver.agreed) {
      setMsg('Нужна согласованная версия сметы')
      return
    }
    if (!plannedStart) {
      setMsg('Укажите плановую дату начала работ')
      return
    }
    setBusy(true)
    try {
      const number = lockedNumber || allocateContractNumber()
      const addr = picker.selectedObject.address || picker.selectedObject.title
      const area = picker.selectedObject.areaM2 || 0
      const objectTitle = picker.selectedObject.title || ''

      await generateRemontDoc(picker.client, {
        number,
        date,
        city,
        objectAddress: addr,
        areaM2: area,
        totalSum: ver.total,
        workDays,
        executorName: CONTRACTOR.name,
        discountPct: ver.discountPct,
        baseTotal: ver.baseTotal,
        smetaLines: ver.lines.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section,
        })),
      })
      await generateSmetaDoc(picker.client, {
        number,
        date,
        city,
        objectAddress: addr,
        objectTitle,
        areaM2: area,
        workDays,
        discountPct: ver.discountPct,
        rolledUp: false,
        lines: ver.lines.map((l) => ({
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          price: l.price,
          section: l.section || 'Прочее',
        })),
        executorName: CONTRACTOR.name,
      })
      await generateTzStubDoc(picker.client, {
        number,
        date,
        city,
        objectAddress: addr,
        contractNumber: number,
        executorName: CONTRACTOR.name,
      })

      const doc = upsertIssuedDoc({
        id: editDocId || undefined,
        kind: 'repair',
        contractNumber: number,
        clientId: picker.client.id,
        objectId: picker.selectedObject.id,
        title: `Ремонт · смета «${ver.label}»`,
        status: 'agreed',
        calcVersionId: ver.id,
        plannedStartDate: plannedStart,
        total: ver.total,
        areaM2: area,
        city,
        objectAddress: addr,
        docDate: date,
        workDays,
        discountPct: ver.discountPct,
        baseTotal: ver.baseTotal,
        objectTitle,
      })

      const tz = upsertIssuedDoc({
        id: tzDocId || undefined,
        kind: 'tz',
        clientId: picker.client.id,
        objectId: picker.selectedObject.id,
        title: `ТЗ (заглушка) к дог. ${number}`,
        status: 'issued',
        parentContractId: doc.id,
        contractNumber: number,
        objectAddress: addr,
        city,
        docDate: date,
      })
      const smeta = upsertIssuedDoc({
        id: smetaDocId || undefined,
        kind: 'smeta',
        clientId: picker.client.id,
        objectId: picker.selectedObject.id,
        title: `Смета к дог. ${number}`,
        status: 'agreed',
        parentContractId: doc.id,
        contractNumber: number,
        calcVersionId: ver.id,
        total: ver.total,
        objectAddress: addr,
        city,
        docDate: date,
        workDays,
        areaM2: area,
        objectTitle,
        discountPct: ver.discountPct,
        baseTotal: ver.baseTotal,
      })
      setTzDocId(tz.id)
      setSmetaDocId(smeta.id)

      const all = loadClients()
      saveClients(
        all.map((c) => {
          if (c.id !== picker.client!.id) return c
          return {
            ...c,
            dogovor_otdelka: number,
            smeta: ver.label,
            objects: c.objects.map((o) =>
              o.id === picker.selectedObject!.id
                ? {
                    ...o,
                    contractNumber: number,
                    startDate: plannedStart,
                    inWork: true,
                  }
                : o,
            ),
            updatedAt: new Date().toISOString(),
          }
        }),
      )

      setContractId(doc.id)
      setEditDocId(doc.id)
      setContractNumber(number)
      setLockedNumber(number)
      setStep(4)
      setMsg(
        editing
          ? `Договор № ${number}: обновлён (тот же номер), пакет скачан`
          : `Договор № ${number}: договор, смета и ТЗ-заглушка скачаны`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WizardShell
      title={editing ? `Договор ремонта № ${lockedNumber}` : 'Договор ремонта'}
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {step > 1 && step < 4 && (
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 px-3 text-sm sm:w-auto"
              onClick={() => setStep((s) => s - 1)}
            >
              Назад
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              disabled={!picker.client || !picker.objectId}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:col-auto sm:w-auto"
              onClick={() => setStep(2)}
            >
              Далее: смета
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!agreed && !(activeVersion?.agreed)}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:col-auto sm:w-auto"
              onClick={() => setStep(3)}
            >
              Далее: согласование и выпуск
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={busy}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:col-auto sm:w-auto"
              onClick={() => void issueContract()}
            >
              {busy
                ? 'Формируем…'
                : editing
                  ? 'Сохранить и скачать PDF'
                  : 'Согласовать договор + скачать PDF'}
            </button>
          )}
          {msg && <span className="col-span-2 text-sm text-gray-600 sm:col-auto">{msg}</span>}
        </div>
      }
    >
      {editing && step < 4 && (
        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Редактирование записи реестра. При сохранении останется №{' '}
          <strong>{lockedNumber}</strong>; связанные смета и ТЗ обновятся без новых номеров.
        </p>
      )}

      <ol className="flex flex-wrap gap-2 text-xs font-medium text-gray-500">
        {['Клиент и объект', 'Смета', 'Выпуск', 'Готово'].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-2.5 py-1 ${
              step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 && <ClientObjectPicker picker={picker} />}

      {step === 2 && (
        <div className="space-y-3">
          <CalculatorPanel
            embedded
            compact
            onChange={() => {
              /* sync via calcTransfer; bump versions refresh hint */
            }}
          />
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-sm text-gray-600">
              Текущий расчёт в буфере:{' '}
              <strong>{transfer.lines.length}</strong> строк ·{' '}
              <strong>{formatMoney(transfer.total)} ₽</strong>. Сохраните версию и
              согласуйте её перед выпуском.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-gray-300 px-2.5 text-xs font-medium"
                onClick={saveCurrentAsVersion}
              >
                Сохранить текущий расчёт как версию
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-900"
                onClick={markAgreed}
              >
                Пометить выбранную согласованной
              </button>
            </div>
            {versions.length === 0 ? (
              <p className="text-sm text-amber-700">
                Версий ещё нет — заполните объёмы выше и сохраните версию.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {versions.map((v) => (
                  <li key={v.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm hover:bg-gray-50">
                      <input
                        type="radio"
                        name="ver"
                        checked={versionId === v.id || (!versionId && v.agreed)}
                        onChange={() => setVersionId(v.id)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{v.label}</span>
                      <span className="text-gray-600">{formatMoney(v.total)} ₽</span>
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

      {step === 3 && (
        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-2">
          <Field label="Дата договора">
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Город">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Срок работ, раб. дней">
            <input
              type="number"
              className={inputCls}
              value={workDays}
              onChange={(e) => setWorkDays(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Плановая дата начала" hint="Статус договора → согласованный">
            <input
              type="date"
              className={inputCls}
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 rounded-md bg-gray-50 p-3 text-sm">
            <p>
              Смета:{' '}
              <strong>
                {(activeVersion || agreed)?.label || '—'} ·{' '}
                {formatMoney((activeVersion || agreed)?.total || 0)} ₽
              </strong>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {editing
                ? `Будут обновлены PDF: договор, смета, ТЗ. Номер № ${lockedNumber} сохранится.`
                : 'Будут скачаны: договор ремонта, смета, ТЗ-заглушка. Номер — из сквозного счётчика.'}
            </p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">
            Договор ремонта № {contractNumber} {editing ? 'обновлён' : 'согласован'}
          </p>
          <p className="mt-1">
            Пакет скачан. Можно выписывать акты.{' '}
            {contractId && (
              <button
                type="button"
                className="text-blue-700 underline"
                onClick={() =>
                  updateIssuedDoc(contractId, { plannedStartDate: plannedStart })
                }
              >
                Дата старта сохранена
              </button>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link to="/documents/acts" className="font-medium text-blue-700 hover:underline">
              Перейти к актам →
            </Link>
            <Link to="/documents" className="font-medium text-blue-700 hover:underline">
              ← Хаб
            </Link>
          </div>
        </div>
      )}
    </WizardShell>
  )
}

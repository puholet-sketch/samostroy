import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  agreeCalcVersion,
  listCalcVersions,
  saveCalcVersionFromTransfer,
  versionStatusLabel,
  type CalcVersion,
} from '../../lib/calcVersions'
import { loadCalcTransfer } from '../../lib/calcTransfer'
import { emptyClient } from '../../lib/clients'
import { CONTRACTOR } from '../../lib/contractor'
import {
  allocateSmetaNumber,
  getIssuedDoc,
  markDocIssued,
  STANDALONE_SMETA_CLIENT,
  upsertIssuedDoc,
} from '../../lib/docRegistry'
import { generateSmetaDoc } from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import CalculatorPanel from '../calculator/CalculatorPanel'
import { Field, WizardShell, inputCls, todayIso } from './docUi'

export default function SmetaWizardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const docIdParam = searchParams.get('docId') || ''
  const hydratedRef = useRef('')
  /** Стабильный id сметы с первого шага — версии калькулятора привязаны к нему. */
  const sessionIdRef = useRef(docIdParam || `doc-smeta-${Date.now()}`)
  const [step, setStep] = useState(1)
  const [date, setDate] = useState(todayIso)
  const [city, setCity] = useState('Москва')
  const [address, setAddress] = useState('')
  const [objectTitle, setObjectTitle] = useState('')
  const [areaM2, setAreaM2] = useState(0)
  const [workDays, setWorkDays] = useState(80)
  const [versions, setVersions] = useState<CalcVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editDocId, setEditDocId] = useState(docIdParam || sessionIdRef.current)
  const [lockedNumber, setLockedNumber] = useState('')
  const [issuedNumber, setIssuedNumber] = useState('')

  const calcObjectId = editDocId

  useEffect(() => {
    document.title = 'Смета без договора — СамоСтрой'
  }, [])

  useEffect(() => {
    if (!docIdParam || hydratedRef.current === docIdParam) return
    const doc = getIssuedDoc(docIdParam)
    if (!doc || doc.kind !== 'smeta' || doc.parentContractId) return
    hydratedRef.current = docIdParam
    sessionIdRef.current = doc.id
    setEditDocId(doc.id)
    setLockedNumber(doc.contractNumber || '')
    setIssuedNumber(doc.contractNumber || '')
    if (doc.docDate) setDate(doc.docDate)
    if (doc.city) setCity(doc.city)
    if (doc.objectAddress) setAddress(doc.objectAddress)
    if (doc.objectTitle) setObjectTitle(doc.objectTitle)
    if (doc.areaM2) setAreaM2(doc.areaM2)
    if (doc.workDays) setWorkDays(doc.workDays)
    if (doc.calcVersionId) setVersionId(doc.calcVersionId)
    setStep(1)
    setMsg(`Редактирование сметы № ${doc.contractNumber || '—'}`)
  }, [docIdParam])

  useEffect(() => {
    setVersions(listCalcVersions(STANDALONE_SMETA_CLIENT, calcObjectId))
  }, [calcObjectId, msg])

  useEffect(() => {
    if (step >= 4) return
    const next = new URLSearchParams()
    if (editDocId) next.set('docId', editDocId)
    const cur = searchParams.toString()
    const want = next.toString()
    if (cur !== want) setSearchParams(next, { replace: true })
  }, [editDocId, step, searchParams, setSearchParams])

  const transfer = useMemo(() => loadCalcTransfer(), [step, msg])
  const activeVersion = versions.find((v) => v.id === versionId)
  const agreed = versions.find((v) => v.agreed)
  const editing = Boolean(editDocId && lockedNumber)

  function refreshVersions() {
    setVersions(listCalcVersions(STANDALONE_SMETA_CLIENT, calcObjectId))
  }

  function saveCurrentAsVersion() {
    const t = loadCalcTransfer()
    if (!t.lines.length) {
      setMsg('В калькуляторе нет строк — заполните смету')
      return
    }
    const v = saveCalcVersionFromTransfer({
      clientId: STANDALONE_SMETA_CLIENT,
      objectId: calcObjectId,
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

  async function issueSmeta() {
    setMsg('')
    if (!address.trim()) {
      setMsg('Укажите адрес объекта')
      return
    }
    const ver = versions.find((v) => v.id === versionId) || agreed
    if (!ver || !ver.agreed) {
      setMsg('Нужна согласованная версия сметы')
      return
    }
    setBusy(true)
    try {
      const number = lockedNumber || allocateSmetaNumber()
      const stub = emptyClient({
        id: 'anon',
        name: 'Заказчик не указан',
        city,
        address: address.trim(),
      })
      const lines = ver.lines.map((l) => ({
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        price: l.price,
        section: l.section || 'Прочее',
      }))

      await generateSmetaDoc(stub, {
        number,
        date,
        city,
        objectAddress: address.trim(),
        objectTitle: objectTitle.trim(),
        areaM2,
        workDays,
        discountPct: ver.discountPct,
        rolledUp: false,
        lines,
        executorName: CONTRACTOR.name,
      })

      const doc = upsertIssuedDoc({
        id: sessionIdRef.current,
        kind: 'smeta',
        contractNumber: number,
        clientId: STANDALONE_SMETA_CLIENT,
        objectId: sessionIdRef.current,
        title: `Смета без договора · ${address.trim()}`,
        status: 'issued',
        calcVersionId: ver.id,
        total: ver.total,
        areaM2,
        city,
        objectAddress: address.trim(),
        objectTitle: objectTitle.trim(),
        docDate: date,
        workDays,
        discountPct: ver.discountPct,
        baseTotal: ver.baseTotal,
        actLines: lines,
      })

      markDocIssued(doc.id)
      setEditDocId(doc.id)
      setLockedNumber(number)
      setIssuedNumber(number)
      setStep(4)
      setMsg(
        editing
          ? `Смета № ${number}: обновлена (тот же номер), PDF скачан`
          : `Смета № ${number}: выпущена и скачана`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  function transferToRepair() {
    const id = editDocId
    if (!id) {
      setMsg('Сначала выпустите смету')
      return
    }
    navigate(`/documents/repair?fromSmetaId=${encodeURIComponent(id)}`)
  }

  return (
    <WizardShell
      title={editing ? `Смета № ${lockedNumber}` : 'Смета без договора'}
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
              disabled={!address.trim()}
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
              Далее: выпуск
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={busy}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:col-auto sm:w-auto"
              onClick={() => void issueSmeta()}
            >
              {busy
                ? 'Формируем…'
                : editing
                  ? 'Сохранить и скачать PDF'
                  : 'Выпустить смету + скачать PDF'}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white sm:col-auto sm:w-auto"
              onClick={transferToRepair}
            >
              Перенести в договор
            </button>
          )}
          {msg && <span className="col-span-2 text-sm text-gray-600 sm:col-auto">{msg}</span>}
        </div>
      }
    >
      {editing && step < 4 && (
        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Редактирование сметы без договора. При сохранении останется №{' '}
          <strong>{lockedNumber}</strong> (свой счётчик, не договорный).
        </p>
      )}

      <ol className="flex flex-wrap gap-2 text-xs font-medium text-gray-500">
        {['Адрес', 'Смета', 'Выпуск', 'Готово'].map((label, i) => (
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

      {step === 1 && (
        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm text-gray-600">
            ФИО клиента не требуется — только адрес и параметры объекта для предварительного
            расчёта.
          </p>
          <Field label="Адрес объекта" className="sm:col-span-2">
            <input
              className={inputCls}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ул. …, д. …"
            />
          </Field>
          <Field label="Название объекта (необяз.)">
            <input
              className={inputCls}
              value={objectTitle}
              onChange={(e) => setObjectTitle(e.target.value)}
              placeholder="Квартира / дом"
            />
          </Field>
          <Field label="Город">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Площадь, м²">
            <input
              type="number"
              className={inputCls}
              value={areaM2 || ''}
              onChange={(e) => setAreaM2(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Срок работ, раб. дней">
            <input
              type="number"
              className={inputCls}
              value={workDays}
              onChange={(e) => setWorkDays(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Дата сметы">
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <CalculatorPanel
            embedded
            compact
            onChange={() => {
              /* sync via calcTransfer */
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
                        name="smeta-ver"
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
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
          <p>
            Адрес: <strong>{address || '—'}</strong>
          </p>
          <p className="mt-1">
            Смета:{' '}
            <strong>
              {(activeVersion || agreed)?.label || '—'} ·{' '}
              {formatMoney((activeVersion || agreed)?.total || 0)} ₽
            </strong>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {editing
              ? `Будет обновлён PDF. Номер № ${lockedNumber} сохранится (счётчик смет).`
              : 'Будет скачан PDF. Номер — из отдельного счётчика смет (С-N), не из договоров.'}
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">
            Смета № {issuedNumber} {editing ? 'обновлена' : 'выпущена'}
          </p>
          <p className="mt-1">
            PDF скачан. Можно перенести расчёт в мастер договора ремонта — шаг со сметой
            уже будет заполнен.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="font-medium text-blue-700 underline"
              onClick={transferToRepair}
            >
              Перенести в договор →
            </button>
            <Link to="/documents" className="font-medium text-blue-700 hover:underline">
              ← Хаб
            </Link>
          </div>
        </div>
      )}
    </WizardShell>
  )
}

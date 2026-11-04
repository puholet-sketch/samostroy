import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  upsertIssuedDoc,
  updateIssuedDoc,
} from '../../lib/docRegistry'
import {
  generateRemontDoc,
  generateSmetaDoc,
  generateTzStubDoc,
} from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import {
  ClientObjectPicker,
  Field,
  WizardShell,
  inputCls,
  todayIso,
  useClientObjectPicker,
} from './docUi'

export default function RepairWizardPage() {
  const picker = useClientObjectPicker()
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

  useEffect(() => {
    document.title = 'Договор ремонта — СамоСтрой'
  }, [])

  useEffect(() => {
    if (picker.client?.city) setCity(picker.client.city)
    if (picker.selectedObject?.startDate) setPlannedStart(picker.selectedObject.startDate)
  }, [picker.client?.id, picker.selectedObject?.id])

  useEffect(() => {
    if (!picker.clientId || !picker.objectId) {
      setVersions([])
      return
    }
    setVersions(listCalcVersions(picker.clientId, picker.objectId))
  }, [picker.clientId, picker.objectId, msg])

  const transfer = useMemo(() => loadCalcTransfer(), [step, msg])
  const activeVersion = versions.find((v) => v.id === versionId)
  const agreed = versions.find((v) => v.agreed)

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
      const number = allocateContractNumber()
      const addr = picker.selectedObject.address || picker.selectedObject.title
      const area = picker.selectedObject.areaM2 || 0

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
        objectTitle: picker.selectedObject.title || '',
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
      })
      upsertIssuedDoc({
        kind: 'tz',
        clientId: picker.client.id,
        objectId: picker.selectedObject.id,
        title: `ТЗ (заглушка) к дог. ${number}`,
        status: 'issued',
        parentContractId: doc.id,
        contractNumber: number,
        objectAddress: addr,
        city,
      })
      upsertIssuedDoc({
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
      })

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
      setContractNumber(number)
      setStep(4)
      setMsg(`Договор № ${number}: договор, смета и ТЗ-заглушка скачаны`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WizardShell
      title="Договор ремонта"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {step > 1 && step < 4 && (
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              onClick={() => setStep((s) => s - 1)}
            >
              Назад
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              disabled={!picker.client || !picker.objectId}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => setStep(2)}
            >
              Далее: смета
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!agreed && !(activeVersion?.agreed)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => setStep(3)}
            >
              Далее: согласование и выпуск
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => void issueContract()}
            >
              {busy ? 'Формируем…' : 'Согласовать договор + скачать пакет'}
            </button>
          )}
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      }
    >
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
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-sm text-gray-600">
            Смета в этом потоке — версии расчёта калькулятора по объекту. Сейчас в буфере:{' '}
            <strong>{transfer.lines.length}</strong> строк ·{' '}
            <strong>{formatMoney(transfer.total)} ₽</strong>.{' '}
            <Link to="/calculator" className="text-blue-700 hover:underline">
              Открыть калькулятор
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium"
              onClick={saveCurrentAsVersion}
            >
              Сохранить текущий расчёт как версию
            </button>
            <button
              type="button"
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900"
              onClick={markAgreed}
            >
              Пометить выбранную согласованной
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="text-sm text-amber-700">Версий ещё нет — сохраните из калькулятора.</p>
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
                        v.agreed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
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
              Будут скачаны: договор ремонта, смета, ТЗ-заглушка. Номер — из сквозного счётчика.
            </p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">Договор ремонта № {contractNumber} согласован</p>
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

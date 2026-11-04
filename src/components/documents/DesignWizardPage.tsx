import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTRACTOR } from '../../lib/contractor'
import {
  DESIGN_TARIFFS,
  getDesignTariff,
  includedDesignStages,
  type DesignTariffId,
} from '../../lib/designTariffs'
import {
  allocateContractNumber,
  upsertIssuedDoc,
} from '../../lib/docRegistry'
import { generateDesignDoc } from '../../lib/generateDocs'
import { formatMoney } from '../../lib/moneyRu'
import { loadClients, saveClients } from '../../lib/clients'
import {
  ClientObjectPicker,
  Field,
  WizardShell,
  inputCls,
  todayIso,
  useClientObjectPicker,
} from './docUi'

export default function DesignWizardPage() {
  const picker = useClientObjectPicker()
  const [step, setStep] = useState(1)
  const [tariffId, setTariffId] = useState<DesignTariffId>('full')
  const [date, setDate] = useState(todayIso)
  const [city, setCity] = useState('Москва')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [issuedNumber, setIssuedNumber] = useState('')

  useEffect(() => {
    document.title = 'Договор дизайна — СамоСтрой'
  }, [])

  useEffect(() => {
    if (picker.client?.city) setCity(picker.client.city)
  }, [picker.client?.id])

  const area = picker.selectedObject?.areaM2 || 0
  const tariff = getDesignTariff(tariffId)
  const stages = useMemo(() => includedDesignStages(tariffId), [tariffId])
  const total = area * tariff.ratePerM2

  async function issue() {
    setMsg('')
    if (!picker.client || !picker.selectedObject) {
      setMsg('Выберите клиента и объект')
      return
    }
    if (!area) {
      setMsg('Укажите площадь объекта в карточке клиента')
      return
    }
    setBusy(true)
    try {
      const number = allocateContractNumber()
      const addr = picker.selectedObject.address || picker.selectedObject.title
      await generateDesignDoc(picker.client, {
        number,
        date,
        city,
        objectAddress: addr,
        areaM2: area,
        executorName: CONTRACTOR.name,
        tariffId,
      })
      upsertIssuedDoc({
        kind: 'design',
        contractNumber: number,
        clientId: picker.client.id,
        objectId: picker.selectedObject.id,
        title: `Дизайн · тариф ${tariff.label}`,
        status: 'issued',
        tariffId,
        ratePerM2: tariff.ratePerM2,
        excludedClauses: tariff.excludeClauses,
        total,
        areaM2: area,
        city,
        objectAddress: addr,
      })
      // проставить № на объект + meta КК
      const all = loadClients()
      const next = all.map((c) => {
        if (c.id !== picker.client!.id) return c
        return {
          ...c,
          dogovor_design: number,
          objects: c.objects.map((o) =>
            o.id === picker.selectedObject!.id
              ? { ...o, contractNumber: o.contractNumber || number }
              : o,
          ),
          updatedAt: new Date().toISOString(),
        }
      })
      saveClients(next)
      setIssuedNumber(number)
      setStep(4)
      setMsg(`Договор № ${number} скачан и записан в реестр`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WizardShell
      title="Договор дизайна"
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
              Далее: тариф
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => setStep(3)}
            >
              Далее: выпуск
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => void issue()}
            >
              {busy ? 'Формируем…' : 'Выпустить и скачать DOCX'}
            </button>
          )}
          {step === 4 && (
            <Link
              to="/documents/registry?kind=design"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              В реестр дизайна
            </Link>
          )}
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      }
    >
      <ol className="flex flex-wrap gap-2 text-xs font-medium text-gray-500">
        {['Клиент и объект', 'Тариф', 'Выпуск', 'Готово'].map((label, i) => (
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
            Площадь объекта: <strong>{area || '—'} м²</strong>
            {!area && (
              <span className="text-amber-700">
                {' '}
                — задайте в карточке, иначе сумма будет 0
              </span>
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {DESIGN_TARIFFS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTariffId(t.id)}
                className={`rounded-lg border p-3 text-left ${
                  tariffId === t.id
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">{t.label}</div>
                <div className="text-sm text-gray-700">
                  {t.ratePerM2.toLocaleString('ru-RU')} ₽/м²
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {t.excludeClauses.length
                    ? `Исключены: ${t.excludeClauses.join(', ')}`
                    : 'Все пункты 4.1.x / 4.4.x'}
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
            В договоре останутся этапы:{' '}
            {stages.map((s) => s.short).join('; ') || '—'}. Сумма ≈{' '}
            <strong>{formatMoney(total)} ₽</strong>
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
          <div className="sm:col-span-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-gray-800">
            <p>
              Клиент: <strong>{picker.client?.name}</strong>
            </p>
            <p>
              Объект: <strong>{picker.selectedObject?.address || '—'}</strong> · {area} м²
            </p>
            <p>
              Тариф: <strong>{tariff.label}</strong> · {tariff.ratePerM2} ₽/м² ·{' '}
              {formatMoney(total)} ₽
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Номер договора будет выделен из сквозного счётчика при выпуске.
            </p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">Договор дизайна № {issuedNumber} выпущен</p>
          <p className="mt-1">Файл скачан. Запись в реестре и на карточке клиента.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link to="/documents" className="font-medium text-blue-700 hover:underline">
              ← В хаб
            </Link>
            <button
              type="button"
              className="font-medium text-blue-700 hover:underline"
              onClick={() => {
                setStep(1)
                setIssuedNumber('')
                setMsg('')
              }}
            >
              Ещё один договор
            </button>
          </div>
        </div>
      )}
    </WizardShell>
  )
}

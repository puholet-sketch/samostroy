import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { RiPhoneFill } from '@remixicon/react'
import { loadClients, saveClients, telHref, type ClientCard } from '../../lib/clients'
import { Panel } from '../ui/Kpi'

export type ClientSection = 'main' | 'passport' | 'legal' | 'docs'

export const CLIENT_SECTIONS: { id: ClientSection; label: string }[] = [
  { id: 'main', label: 'Основные' },
  { id: 'passport', label: 'Паспорт' },
  { id: 'legal', label: 'Юрлицо' },
  { id: 'docs', label: 'Документы' },
]

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ClientCardPage() {
  const { id, section } = useParams<{ id: string; section?: string }>()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientCard[]>(() => loadClients())

  const active = (CLIENT_SECTIONS.some((s) => s.id === section) ? section : 'main') as ClientSection

  const client = useMemo(() => clients.find((c) => c.id === id) ?? null, [clients, id])

  useEffect(() => {
    document.title = client ? `${client.name || 'Клиент'} — СамоСтрой` : 'Клиент — СамоСтрой'
  }, [client])

  useEffect(() => {
    saveClients(clients)
  }, [clients])

  if (!id) return <Navigate to="/clients" replace />
  if (!client) {
    return (
      <Panel>
        <p className="text-sm text-gray-600">Клиент не найден.</p>
        <Link to="/clients" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
          ← К реестру
        </Link>
      </Panel>
    )
  }

  if (!section || !CLIENT_SECTIONS.some((s) => s.id === section)) {
    return <Navigate to={`/clients/${id}/main`} replace />
  }

  function patch(p: Partial<ClientCard>) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === client!.id ? { ...c, ...p, updatedAt: new Date().toISOString() } : c,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex flex-wrap items-center gap-2 whitespace-nowrap text-sm tabular-nums text-gray-500">
          {client.mobile ? (
            <>
              {telHref(client.mobile) && (
                <a
                  href={telHref(client.mobile)!}
                  title="Позвонить"
                  aria-label={`Позвонить ${client.mobile}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50"
                >
                  <RiPhoneFill className="h-4 w-4" />
                </a>
              )}
              <span>{client.mobile}</span>
            </>
          ) : (
            'телефон не указан'
          )}
          {client.city ? <span>· {client.city}</span> : null}
        </p>
        <span
          className={`inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
            client.fizurlico === 'ur' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {client.fizurlico === 'ur' ? 'Юрлицо' : 'Физлицо'}
        </span>
      </div>

      {/* Mobile section switcher (desktop uses sidebar) */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 lg:hidden">
        {CLIENT_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/clients/${id}/${s.id}`)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active === s.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Panel title={CLIENT_SECTIONS.find((s) => s.id === active)?.label}>
        {active === 'main' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Статус">
              <select
                className={inputCls}
                value={client.fizurlico}
                onChange={(e) => patch({ fizurlico: e.target.value as 'fiz' | 'ur' })}
              >
                <option value="fiz">Физлицо</option>
                <option value="ur">Юрлицо</option>
              </select>
            </Field>
            <Field label="Тег">
              <input className={inputCls} value={client.tag} onChange={(e) => patch({ tag: e.target.value })} />
            </Field>
            <Field label="ФИО / Организация" className="sm:col-span-2">
              <input className={inputCls} value={client.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={client.email} onChange={(e) => patch({ email: e.target.value })} />
            </Field>
            <Field label="Мобильный основной">
              <input className={inputCls} value={client.mobile} onChange={(e) => patch({ mobile: e.target.value })} />
            </Field>
            <Field label="Мобильный дополнительный">
              <input className={inputCls} value={client.mobile2} onChange={(e) => patch({ mobile2: e.target.value })} />
            </Field>
            <Field label="Город">
              <input className={inputCls} value={client.city} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <Field label="Источник">
              <input className={inputCls} value={client.source} onChange={(e) => patch({ source: e.target.value })} />
            </Field>
            <Field label="Ссылка Amo" className="sm:col-span-2">
              <input className={inputCls} value={client.amo_link} onChange={(e) => patch({ amo_link: e.target.value })} />
            </Field>
            <Field label="Менеджер">
              <input className={inputCls} value={client.manager} onChange={(e) => patch({ manager: e.target.value })} />
            </Field>
            <Field label="Дизайнер">
              <input className={inputCls} value={client.designer} onChange={(e) => patch({ designer: e.target.value })} />
            </Field>
            <Field label="Комплектатор">
              <input className={inputCls} value={client.picker} onChange={(e) => patch({ picker: e.target.value })} />
            </Field>
            <Field label="Прораб">
              <input className={inputCls} value={client.prorab} onChange={(e) => patch({ prorab: e.target.value })} />
            </Field>
            <Field label="ОТК">
              <input className={inputCls} value={client.otk} onChange={(e) => patch({ otk: e.target.value })} />
            </Field>
            <Field label="Объекты клиента" className="sm:col-span-2">
              <textarea
                className={inputCls}
                rows={2}
                value={client.objects_note}
                onChange={(e) => patch({ objects_note: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={client.client_access_remont}
                onChange={(e) => patch({ client_access_remont: e.target.checked })}
              />
              Доступ клиентской части: Ремонт
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={client.client_access_design}
                onChange={(e) => patch({ client_access_design: e.target.checked })}
              />
              Доступ клиентской части: Дизайн
            </label>
          </div>
        )}

        {active === 'passport' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Дата рождения">
              <input type="date" className={inputCls} value={client.dob} onChange={(e) => patch({ dob: e.target.value })} />
            </Field>
            <Field label="Место рождения">
              <input className={inputCls} value={client.pob} onChange={(e) => patch({ pob: e.target.value })} />
            </Field>
            <Field label="Тип паспорта">
              <input className={inputCls} value={client.type_passport} onChange={(e) => patch({ type_passport: e.target.value })} />
            </Field>
            <Field label="Номер паспорта">
              <input className={inputCls} value={client.passport_number} onChange={(e) => patch({ passport_number: e.target.value })} />
            </Field>
            <Field label="Паспорт выдан" className="sm:col-span-2">
              <input className={inputCls} value={client.passport_issued} onChange={(e) => patch({ passport_issued: e.target.value })} />
            </Field>
            <Field label="Дата выдачи">
              <input
                type="date"
                className={inputCls}
                value={client.passport_date_issued}
                onChange={(e) => patch({ passport_date_issued: e.target.value })}
              />
            </Field>
            <Field label="Код подразделения">
              <input
                className={inputCls}
                value={client.passport_code ?? ''}
                onChange={(e) => patch({ passport_code: e.target.value })}
              />
            </Field>
            <Field label="Адрес регистрации" className="sm:col-span-2">
              <textarea className={inputCls} rows={2} value={client.address} onChange={(e) => patch({ address: e.target.value })} />
            </Field>
            <Field label="Скан: паспорт">
              <input className={inputCls} value={client.files_1} onChange={(e) => patch({ files_1: e.target.value })} />
            </Field>
            <Field label="Скан: прописка">
              <input className={inputCls} value={client.files_2} onChange={(e) => patch({ files_2: e.target.value })} />
            </Field>
          </div>
        )}

        {active === 'legal' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {client.fizurlico !== 'ur' && (
              <p className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Сейчас «Физлицо». Для реквизитов организации переключите статус на «Юрлицо» во вкладке «Основные».
              </p>
            )}
            <Field label="В лице (lico)">
              <input className={inputCls} value={client.lico} onChange={(e) => patch({ lico: e.target.value })} />
            </Field>
            <Field label="На основании">
              <input className={inputCls} value={client.osnovanie} onChange={(e) => patch({ osnovanie: e.target.value })} />
            </Field>
            <Field label="Подписант">
              <input className={inputCls} value={client.podpisant} onChange={(e) => patch({ podpisant: e.target.value })} />
            </Field>
            <Field label="Юр. адрес" className="sm:col-span-2">
              <input className={inputCls} value={client.address_ur} onChange={(e) => patch({ address_ur: e.target.value })} />
            </Field>
            <Field label="ИНН">
              <input className={inputCls} value={client.inn} onChange={(e) => patch({ inn: e.target.value })} />
            </Field>
            <Field label="КПП">
              <input className={inputCls} value={client.kpp} onChange={(e) => patch({ kpp: e.target.value })} />
            </Field>
            <Field label="Банк" className="sm:col-span-2">
              <input className={inputCls} value={client.bank} onChange={(e) => patch({ bank: e.target.value })} />
            </Field>
            <Field label="БИК">
              <input className={inputCls} value={client.bik} onChange={(e) => patch({ bik: e.target.value })} />
            </Field>
            <Field label="Р/с">
              <input className={inputCls} value={client.rs} onChange={(e) => patch({ rs: e.target.value })} />
            </Field>
            <Field label="К/с" className="sm:col-span-2">
              <input className={inputCls} value={client.ks} onChange={(e) => patch({ ks: e.target.value })} />
            </Field>
          </div>
        )}

        {active === 'docs' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Договор дизайн">
              <input
                className={inputCls}
                value={client.dogovor_design}
                onChange={(e) => patch({ dogovor_design: e.target.value })}
              />
            </Field>
            <Field label="Смета">
              <input className={inputCls} value={client.smeta} onChange={(e) => patch({ smeta: e.target.value })} />
            </Field>
            <Field label="Договор отделка" className="sm:col-span-2">
              <input
                className={inputCls}
                value={client.dogovor_otdelka}
                onChange={(e) => patch({ dogovor_otdelka: e.target.value })}
              />
            </Field>
            <p className="sm:col-span-2 text-sm text-gray-500">
              Генерация файлов — в разделе «Договоры и акты».
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}

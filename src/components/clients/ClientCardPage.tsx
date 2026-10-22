import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePageHeaderActions, usePageHeaderMeta } from '../../contexts/PageHeaderContext'
import {
  CHANNEL_OPTIONS,
  deleteClient,
  loadClients,
  saveClients,
  type ClientCard,
  type ClientObject,
} from '../../lib/clients'
import { Panel } from '../ui/Kpi'
import { PhoneActions } from '../ui/PhoneActions'

export type ClientSection = 'main' | 'passport' | 'legal' | 'docs'

export const CLIENT_SECTIONS: { id: ClientSection; label: string }[] = [
  { id: 'main', label: 'Контакты' },
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
      <span className="mb-0.5 block text-[11px] font-medium leading-tight text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm leading-tight text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ClientCardPage() {
  const { id, section } = useParams<{ id: string; section?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [clients, setClients] = useState<ClientCard[]>(() => loadClients())
  const [saveMsg, setSaveMsg] = useState('')

  const active = (CLIENT_SECTIONS.some((s) => s.id === section) ? section : 'main') as ClientSection

  const client = useMemo(() => clients.find((c) => c.id === id) ?? null, [clients, id])

  const headerMeta = useMemo(() => {
    if (!client) return null
    return (
      <p className="inline-flex max-w-full items-center gap-1.5 text-sm text-gray-500">
        {client.mobile ? (
          <PhoneActions phone={client.mobile} size="sm" />
        ) : (
          <span className="text-gray-400">нет телефона</span>
        )}
        {client.city ? <span className="truncate">· {client.city}</span> : null}
      </p>
    )
  }, [client])

  const headerActions = useMemo(() => {
    if (!client) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
            client.fizurlico === 'ur' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {client.fizurlico === 'ur' ? 'Юрлицо' : 'Физлицо'}
        </span>
        <button
          type="button"
          onClick={() => {
            saveClients(clients)
            setSaveMsg('Сохранено')
            window.setTimeout(() => setSaveMsg(''), 2000)
          }}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Сохранить
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Удалить клиента «${client.name || 'без имени'}» безвозвратно?`)) return
              deleteClient(client.id)
              navigate('/clients')
            }}
            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        )}
      </div>
    )
  }, [client, clients, isOwner, navigate])

  usePageHeaderMeta(headerMeta)
  usePageHeaderActions(headerActions)

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

  function patchObject(objId: string, p: Partial<ClientObject>) {
    if (!client) return
    const objects = client.objects.map((o) => (o.id === objId ? { ...o, ...p } : o))
    patch({ objects })
  }

  function addObject() {
    if (!client) return
    const o: ClientObject = {
      id: `obj-${Date.now()}`,
      address: '',
      title: 'Новый объект',
      contractNumber: '',
    }
    patch({ objects: [...client.objects, o] })
  }

  function removeObject(objId: string) {
    if (!client) return
    patch({ objects: client.objects.filter((o) => o.id !== objId) })
  }

  return (
    <div className="space-y-3">
      {saveMsg && <p className="text-sm text-emerald-700">{saveMsg}</p>}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 lg:hidden">
        {CLIENT_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/clients/${id}/${s.id}`)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-sm font-medium ${
              active === s.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Panel className="!p-3 sm:!p-4">
        {active === 'main' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <Field label="ФИО / Организация" className="col-span-2 xl:col-span-2">
              <input className={inputCls} value={client.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={client.email} onChange={(e) => patch({ email: e.target.value })} />
            </Field>
            <Field label="Мобильный">
              <input className={inputCls} value={client.mobile} onChange={(e) => patch({ mobile: e.target.value })} />
            </Field>
            <Field label="Мобильный доп.">
              <input className={inputCls} value={client.mobile2} onChange={(e) => patch({ mobile2: e.target.value })} />
            </Field>
            <Field label="Город">
              <input className={inputCls} value={client.city} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <Field label="Канал привлечения">
              <select
                className={inputCls}
                value={client.channel}
                onChange={(e) => patch({ channel: e.target.value, source: e.target.value })}
              >
                <option value="">— не указан —</option>
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Источник (доп.)">
              <input className={inputCls} value={client.source} onChange={(e) => patch({ source: e.target.value })} />
            </Field>
            <Field label="Ссылка Amo" className="col-span-2">
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
            <div className="col-span-2 space-y-2 xl:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-gray-500">Объекты (адреса / договоры)</p>
                <button
                  type="button"
                  onClick={addObject}
                  className="rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  + Объект
                </button>
              </div>
              {client.objects.length === 0 && (
                <p className="text-xs text-gray-400">Нет объектов — добавьте адрес для контроля.</p>
              )}
              {client.objects.map((o) => (
                <div
                  key={o.id}
                  className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 sm:grid-cols-3"
                >
                  <input
                    className={inputCls}
                    placeholder="Адрес"
                    value={o.address}
                    onChange={(e) =>
                      patchObject(o.id, {
                        address: e.target.value,
                        title: e.target.value || o.title,
                      })
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Договор №"
                    value={o.contractNumber}
                    onChange={(e) => patchObject(o.id, { contractNumber: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="Название"
                      value={o.title}
                      onChange={(e) => patchObject(o.id, { title: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeObject(o.id)}
                      className="shrink-0 rounded-md border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label
              className="flex cursor-help items-center gap-2 text-xs text-gray-700"
              title="Клиентский доступ к разделу ремонта: смета, договоры на ремонт, отчёты по объекту. Если галочка снята — клиент этот блок в личном кабинете не видит."
            >
              <input
                type="checkbox"
                checked={client.client_access_remont}
                onChange={(e) => patch({ client_access_remont: e.target.checked })}
              />
              Доступ: Ремонт
            </label>
            <label
              className="flex cursor-help items-center gap-2 text-xs text-gray-700"
              title="Клиентский доступ к разделу дизайна: договор на дизайн-проект и связанные материалы. Если галочка снята — клиент дизайн в кабинете не видит."
            >
              <input
                type="checkbox"
                checked={client.client_access_design}
                onChange={(e) => patch({ client_access_design: e.target.checked })}
              />
              Доступ: Дизайн
            </label>
          </div>
        )}

        {active === 'passport' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-3 xl:grid-cols-4">
            <Field label="Дата рождения">
              <input type="date" className={inputCls} value={client.dob} onChange={(e) => patch({ dob: e.target.value })} />
            </Field>
            <Field label="Место рождения" className="col-span-2">
              <input className={inputCls} value={client.pob} onChange={(e) => patch({ pob: e.target.value })} />
            </Field>
            <Field label="Тип паспорта">
              <input className={inputCls} value={client.type_passport} onChange={(e) => patch({ type_passport: e.target.value })} />
            </Field>
            <Field label="Номер паспорта">
              <input className={inputCls} value={client.passport_number} onChange={(e) => patch({ passport_number: e.target.value })} />
            </Field>
            <Field label="Паспорт выдан" className="col-span-2 xl:col-span-2">
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
            <Field label="Адрес регистрации" className="col-span-2 xl:col-span-4">
              <input className={inputCls} value={client.address} onChange={(e) => patch({ address: e.target.value })} />
            </Field>
            <Field label="Скан: паспорт" className="col-span-2">
              <input className={inputCls} value={client.files_1} onChange={(e) => patch({ files_1: e.target.value })} />
            </Field>
            <Field label="Скан: прописка" className="col-span-2">
              <input className={inputCls} value={client.files_2} onChange={(e) => patch({ files_2: e.target.value })} />
            </Field>
          </div>
        )}

        {active === 'legal' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-3 xl:grid-cols-4">
            {client.fizurlico !== 'ur' && (
              <p className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 lg:col-span-3 xl:col-span-4">
                Сейчас «Физлицо». Для реквизитов организации переключите статус на «Юрлицо» во вкладке «Контакты».
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
            <Field label="Юр. адрес" className="col-span-2 xl:col-span-2">
              <input className={inputCls} value={client.address_ur} onChange={(e) => patch({ address_ur: e.target.value })} />
            </Field>
            <Field label="ИНН">
              <input className={inputCls} value={client.inn} onChange={(e) => patch({ inn: e.target.value })} />
            </Field>
            <Field label="КПП">
              <input className={inputCls} value={client.kpp} onChange={(e) => patch({ kpp: e.target.value })} />
            </Field>
            <Field label="Банк" className="col-span-2">
              <input className={inputCls} value={client.bank} onChange={(e) => patch({ bank: e.target.value })} />
            </Field>
            <Field label="БИК">
              <input className={inputCls} value={client.bik} onChange={(e) => patch({ bik: e.target.value })} />
            </Field>
            <Field label="Р/с">
              <input className={inputCls} value={client.rs} onChange={(e) => patch({ rs: e.target.value })} />
            </Field>
            <Field label="К/с" className="col-span-2">
              <input className={inputCls} value={client.ks} onChange={(e) => patch({ ks: e.target.value })} />
            </Field>
          </div>
        )}

        {active === 'docs' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-3">
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
            <Field label="Договор отделка" className="col-span-2 lg:col-span-1">
              <input
                className={inputCls}
                value={client.dogovor_otdelka}
                onChange={(e) => patch({ dogovor_otdelka: e.target.value })}
              />
            </Field>
            <p className="col-span-2 text-xs text-gray-500 lg:col-span-3">
              Генерация файлов — в разделе «Договоры и акты».
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}

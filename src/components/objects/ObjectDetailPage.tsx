import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { RenovationObject, ObjectStage } from '../../services/types'
import PipelinePanel from '../pipeline/PipelinePanel'

export default function ObjectDetailPage() {
  const { id } = useParams()
  const { user, can } = useAuth()
  const [obj, setObj] = useState<RenovationObject | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [structureBusy, setStructureBusy] = useState(false)
  const [structureMsg, setStructureMsg] = useState('')

  useEffect(() => {
    void (async () => {
      if (!id || !user) return
      const list = await api.objects.forUser(user)
      const found = list.find((o) => o.id === id) ?? null
      setObj(found)
      setLoading(false)
    })()
  }, [id, user])

  async function save() {
    if (!obj || !can('objects', 'write')) return
    setSaving(true)
    await api.objects.save(obj)
    setMsg('Сохранено')
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  function updateCrm<K extends keyof RenovationObject['crm']>(key: K, value: RenovationObject['crm'][K]) {
    if (!obj) return
    setObj({ ...obj, crm: { ...obj.crm, [key]: value } })
  }

  function updateStages(stages: ObjectStage[]) {
    if (!obj) return
    setObj({ ...obj, stages })
  }

  if (loading) return <div className="text-gray-500 py-12">Загрузка…</div>
  if (!obj) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-600">Объект не найден или нет доступа</p>
        <Link to="/objects" className="btn-primary mt-4">К списку</Link>
      </div>
    )
  }

  const isClient = user?.role === 'client'
  const writable = can('objects', 'write') && !isClient
  const tasksWritable = can('tasks', 'write') && !isClient

  async function createIssueStructure() {
    if (!obj || !user || !tasksWritable) return
    setStructureBusy(true)
    setStructureMsg('')
    const res = await api.tasks.ensureStructureFromTemplate(obj.id, { actorId: user.id })
    setStructureMsg(
      res.created > 0
        ? `Структура задач: создано ${res.created} элементов`
        : 'Структура задач уже существует',
    )
    setStructureBusy(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/objects"
            className="inline-flex items-center min-h-11 text-sm text-primary-600 hover:underline"
          >
            ← Объекты
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words">{obj.title}</h1>
          <p className="text-sm text-gray-500 break-words">{obj.address}</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          {tasksWritable && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              disabled={structureBusy}
              onClick={() => void createIssueStructure()}
            >
              {structureBusy ? 'Создание…' : 'Создать структуру по шаблону'}
            </button>
          )}
          {can('tasks') && (
            <Link to="/tasks" className="btn-secondary w-full sm:w-auto justify-center">
              К задачам
            </Link>
          )}
          {writable && (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          )}
        </div>
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {structureMsg && <p className="text-sm text-green-600">{structureMsg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">CRM-поля</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Адрес" value={obj.address} onChange={(v) => setObj({ ...obj, address: v })} disabled={!writable} />
              <Field label="Телефон" value={obj.contacts[0]?.phone ?? ''} onChange={(v) => setObj({ ...obj, contacts: [{ ...obj.contacts[0], name: obj.contacts[0]?.name ?? '', phone: v }] })} disabled={!writable} />
              <Field label="Хобби" value={obj.crm.hobbies} onChange={(v) => updateCrm('hobbies', v)} disabled={!writable} />
              <Field label="Канал связи" value={obj.crm.preferredChannel} onChange={(v) => updateCrm('preferredChannel', v)} disabled={!writable} />
              <Field label="Семейное положение" value={obj.crm.maritalStatus} onChange={(v) => updateCrm('maritalStatus', v)} disabled={!writable} />
              <Field label="Возраст" value={String(obj.crm.age ?? '')} onChange={(v) => updateCrm('age', v ? Number(v) : null)} disabled={!writable} />
              <Field label="День рождения" value={obj.crm.birthday ?? ''} onChange={(v) => updateCrm('birthday', v || null)} disabled={!writable} />
              <Field label="Дети" value={String(obj.crm.childrenCount ?? '')} onChange={(v) => updateCrm('childrenCount', v ? Number(v) : null)} disabled={!writable} />
              <Field label="Авто" value={obj.crm.car} onChange={(v) => updateCrm('car', v)} disabled={!writable} />
              <Field label="Профессия" value={obj.crm.occupation} onChange={(v) => updateCrm('occupation', v)} disabled={!writable} />
              <Field label="Старт (желанный)" value={obj.crm.desiredStartDate ?? ''} onChange={(v) => updateCrm('desiredStartDate', v || null)} disabled={!writable} />
              <Field label="След. шаг" value={obj.crm.nextStep} onChange={(v) => updateCrm('nextStep', v)} disabled={!writable} />
              <Field label="Когда след. шаг" value={obj.crm.nextStepAt ?? ''} onChange={(v) => updateCrm('nextStepAt', v || null)} disabled={!writable} />
              <div>
                <label className="label">Материалы</label>
                <select
                  className="input"
                  disabled={!writable}
                  value={obj.crm.materialsMode}
                  onChange={(e) => updateCrm('materialsMode', e.target.value as 'turnkey' | 'customer_materials')}
                >
                  <option value="turnkey">Под ключ</option>
                  <option value="customer_materials">Материалы заказчика</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="designNeeded"
                  type="checkbox"
                  disabled={!writable}
                  checked={obj.crm.designNeeded}
                  onChange={(e) => updateCrm('designNeeded', e.target.checked)}
                />
                <label htmlFor="designNeeded" className="text-sm text-gray-700">Нужен дизайн</label>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Пожелания</label>
                <textarea
                  className="input min-h-[80px]"
                  disabled={!writable}
                  value={obj.crm.wishes}
                  onChange={(e) => updateCrm('wishes', e.target.value)}
                />
              </div>
            </div>
          </div>

          {(can('pipeline') || isClient) && (
            <PipelinePanel
              stages={obj.stages}
              onChange={updateStages}
              writable={can('pipeline', 'write') && !isClient}
              clientMode={isClient}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Гео</h2>
            <Field label="Широта" value={String(obj.lat)} onChange={(v) => setObj({ ...obj, lat: Number(v) || 0 })} disabled={!writable} />
            <div className="mt-3">
              <Field label="Долгота" value={String(obj.lng)} onChange={(v) => setObj({ ...obj, lng: Number(v) || 0 })} disabled={!writable} />
            </div>
            {can('map') && (
              <Link to="/map" className="btn-secondary mt-4 w-full justify-center">
                Открыть карту
              </Link>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Медиа</h2>
            <p className="text-xs text-gray-500 mb-2">Пути к файлам в media/ (не base64)</p>
            <ul className="text-sm text-gray-700 space-y-1">
              {obj.mediaPaths.length === 0 && <li className="text-gray-400">Нет файлов</li>}
              {obj.mediaPaths.map((p) => (
                <li key={p} className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

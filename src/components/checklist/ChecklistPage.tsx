import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { ChecklistsData } from '../../services/types'
import { useObjects } from '../../hooks/useObjects'

export default function ChecklistPage() {
  const { can } = useAuth()
  const { objects } = useObjects()
  const [data, setData] = useState<ChecklistsData | null>(null)
  const [objectId, setObjectId] = useState('')
  const [editTemplate, setEditTemplate] = useState(false)
  const writable = can('checklist', 'write')

  useEffect(() => {
    void api.checklists.get().then((d) => {
      setData(d)
      const first = d.objectChecklists[0]?.objectId ?? objects[0]?.id ?? ''
      setObjectId(first)
    })
  }, [objects])

  const template = data?.templates[0]
  const ocl = useMemo(
    () => data?.objectChecklists.find((c) => c.objectId === objectId),
    [data, objectId],
  )

  async function persist(next: ChecklistsData) {
    setData(next)
    await api.checklists.save(next)
  }

  function toggleAnswer(itemId: string) {
    if (!data || !ocl || !writable) return
    const answers = {
      ...ocl.answers,
      [itemId]: {
        done: !ocl.answers[itemId]?.done,
        note: ocl.answers[itemId]?.note ?? '',
      },
    }
    const next: ChecklistsData = {
      ...data,
      objectChecklists: data.objectChecklists.map((c) =>
        c.id === ocl.id ? { ...c, answers } : c,
      ),
    }
    void persist(next)
  }

  function updateTemplateText(itemId: string, text: string) {
    if (!data || !template || !writable) return
    const next: ChecklistsData = {
      ...data,
      templates: data.templates.map((t) =>
        t.id === template.id
          ? {
              ...t,
              items: t.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
            }
          : t,
      ),
    }
    void persist(next)
  }

  if (!data || !template) return <div className="text-gray-500">Загрузка…</div>

  const sections = [...new Set(template.items.map((i) => i.section))]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Чек-лист продаж</h1>
          <p className="text-sm text-gray-500 mt-1">{template.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select
            className="input w-full sm:w-64"
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
          >
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          {writable && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => setEditTemplate((v) => !v)}
            >
              {editTemplate ? 'К ответам' : 'Править шаблон'}
            </button>
          )}
        </div>
      </div>

      {!ocl && (
        <div className="card p-6 text-sm text-gray-500">
          Для этого объекта ещё нет заполненного чек-листа (stub: создайте в data/checklists.json).
        </div>
      )}

      {sections.map((section) => (
        <div key={section} className="card p-5">
          <h2 className="font-semibold text-primary-700 mb-3">{section}</h2>
          <ul className="space-y-3">
            {template.items
              .filter((i) => i.section === section)
              .map((item) => {
                const ans = ocl?.answers[item.id]
                return (
                  <li key={item.id} className="flex gap-3 items-start min-h-11">
                    {!editTemplate && (
                      <input
                        type="checkbox"
                        className="mt-2 h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        disabled={!writable || !ocl}
                        checked={Boolean(ans?.done)}
                        onChange={() => toggleAnswer(item.id)}
                      />
                    )}
                    <div className="flex-1">
                      {editTemplate && writable ? (
                        <input
                          className="input"
                          value={item.text}
                          onChange={(e) => updateTemplateText(item.id, e.target.value)}
                        />
                      ) : (
                        <div className="text-sm text-gray-900">
                          {item.text}
                          {item.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                      )}
                      {ans?.note && !editTemplate && (
                        <div className="text-xs text-gray-500 mt-1">{ans.note}</div>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

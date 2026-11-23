import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCalcVersion } from '../../lib/calcVersions'
import { loadClients } from '../../lib/clients'
import { downloadIssuedDocPdf, wizardHrefForDoc } from '../../lib/docActions'
import {
  getIssuedDoc,
  isDocDirtyVsIssued,
  isStandaloneSmeta,
  kindLabel,
  statusLabel,
} from '../../lib/docRegistry'
import { formatMoney } from '../../lib/moneyRu'

type Props = {
  docId: string
  onClose: () => void
}

function Attr({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-gray-900">{value}</dd>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">{children}</dl>
    </div>
  )
}

export default function DocCardModal({ docId, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)

  const doc = useMemo(() => {
    void tick
    return getIssuedDoc(docId)
  }, [docId, tick])

  const clients = useMemo(() => {
    void tick
    return loadClients()
  }, [tick])

  if (!doc) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-gray-700">Документ не найден.</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  const client = clients.find((c) => c.id === doc.clientId)
  const object = client?.objects.find((o) => o.id === doc.objectId)
  const calc = doc.calcVersionId ? getCalcVersion(doc.calcVersionId) : undefined
  const dirty = isDocDirtyVsIssued(doc)
  const href = wizardHrefForDoc(doc)
  const canPdf = doc.kind !== 'furniture'
  const numberLabel =
    doc.kind === 'act'
      ? `этап ${doc.actStageNumber ?? '—'}`
      : doc.contractNumber || '—'

  async function download(reissue: boolean) {
    setErr('')
    setBusy(true)
    try {
      const fresh = getIssuedDoc(docId)
      if (!fresh) throw new Error('Документ не найден')
      await downloadIssuedDocPdf(fresh)
      setTick((t) => t + 1)
      if (reissue) {
        /* fingerprint обновлён в downloadIssuedDocPdf */
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Не удалось скачать PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-card-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {kindLabel(doc.kind)}
              {isStandaloneSmeta(doc) ? ' · без договора' : ''}
            </p>
            <h2
              id="doc-card-title"
              className="truncate text-lg font-semibold text-gray-900"
            >
              № {numberLabel}
            </h2>
            <p className="mt-0.5 truncate text-sm text-gray-500">{doc.title}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <Panel title="Основные">
            <Attr label="Статус" value={statusLabel(doc.status)} />
            <Attr
              label="Дата документа"
              value={doc.docDate || doc.createdAt.slice(0, 10)}
            />
            <Attr label="Город" value={doc.city} />
            <Attr label="Адрес" value={doc.objectAddress} />
            <Attr
              label="Сумма"
              value={
                doc.total != null ? `${formatMoney(doc.total)} ₽` : undefined
              }
            />
            <Attr
              label="Площадь"
              value={doc.areaM2 != null ? `${doc.areaM2} м²` : undefined}
            />
            <Attr
              label="Срок"
              value={doc.workDays != null ? `${doc.workDays} раб. дн.` : undefined}
            />
            {doc.kind === 'design' && (
              <Attr label="Тариф" value={doc.tariffId} />
            )}
            {doc.kind === 'act' && (
              <>
                <Attr label="Этап" value={doc.stageName} />
                <Attr
                  label="Оплачено"
                  value={
                    doc.paid != null ? `${formatMoney(doc.paid)} ₽` : undefined
                  }
                />
              </>
            )}
            {doc.plannedStartDate && (
              <Attr label="Старт работ" value={doc.plannedStartDate} />
            )}
          </Panel>

          {(client || object || isStandaloneSmeta(doc)) && (
            <Panel title="Клиент и объект">
              <Attr
                label="Клиент"
                value={
                  client ? (
                    <Link
                      to={`/clients/${client.id}/docs`}
                      className="text-blue-700 hover:underline"
                      onClick={onClose}
                    >
                      {client.name}
                    </Link>
                  ) : isStandaloneSmeta(doc) ? (
                    'не указан (смета без договора)'
                  ) : (
                    doc.clientId || '—'
                  )
                }
              />
              <Attr
                label="Объект"
                value={
                  object
                    ? object.title || object.address
                    : doc.objectTitle || doc.objectAddress || '—'
                }
              />
              {object?.areaM2 != null && object.areaM2 > 0 && (
                <Attr label="Площадь в КК" value={`${object.areaM2} м²`} />
              )}
            </Panel>
          )}

          {(calc || doc.calcVersionId) && (
            <Panel title="Расчёт">
              <Attr label="Версия" value={calc?.label || doc.calcVersionId} />
              <Attr
                label="Итого"
                value={
                  calc
                    ? `${formatMoney(calc.total)} ₽`
                    : doc.total != null
                      ? `${formatMoney(doc.total)} ₽`
                      : undefined
                }
              />
              <Attr
                label="Скидка"
                value={
                  (calc?.discountPct ?? doc.discountPct)
                    ? `${calc?.discountPct ?? doc.discountPct} %`
                    : undefined
                }
              />
              <Attr
                label="Строк"
                value={
                  calc?.lines?.length != null
                    ? String(calc.lines.length)
                    : doc.actLines?.length != null
                      ? String(doc.actLines.length)
                      : undefined
                }
              />
            </Panel>
          )}

          {dirty && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              После последнего выпуска данные изменились. Можно перевыпустить PDF
              или скачать эквивалент по текущим полям.
            </p>
          )}

          {err && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {err}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
          {canPdf && (
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40 sm:flex-none"
              onClick={() => void download(false)}
            >
              {busy ? 'PDF…' : 'Скачать'}
            </button>
          )}
          {canPdf && dirty && (
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-amber-400 bg-amber-50 px-3 text-sm font-semibold text-amber-950 disabled:opacity-40 sm:flex-none"
              onClick={() => void download(true)}
            >
              {busy ? 'PDF…' : 'Перевыпустить'}
            </button>
          )}
          {href && doc.kind !== 'furniture' && (
            <Link
              to={href}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 sm:flex-none"
              onClick={onClose}
            >
              Изменить
            </Link>
          )}
          {isStandaloneSmeta(doc) && (
            <Link
              to={`/documents/repair?fromSmetaId=${encodeURIComponent(doc.id)}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 sm:flex-none"
              onClick={onClose}
            >
              Перенести в договор
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

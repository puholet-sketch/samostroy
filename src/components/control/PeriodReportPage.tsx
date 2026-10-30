import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadClients } from '../../lib/clients'
import {
  buildPeriodReportRows,
  defaultPeriodRange,
  type PeriodReportRow,
} from '../../lib/periodReport'
import {
  loadPeriodFilters,
  savePeriodFilters,
  type PeriodReportFilters,
} from '../../lib/periodReportFilters'
import { todayIso } from '../../lib/objectReports'

function parseIso(raw: string | null, fallback: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return fallback
}

function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function escapeCell(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function SummaryStats({ rows }: { rows: PeriodReportRow[] }) {
  const has = rows.filter((r) => r.status === 'есть').length
  const miss = rows.length - has
  const objects = new Set(rows.map((r) => `${r.objectAddress}|${r.objectTitle}`)).size
  return (
    <p className="period-meta">
      Объектов: <strong>{objects}</strong>
      {' · '}
      Строк: <strong>{rows.length}</strong>
      {' · '}
      Есть отчёт: <strong className="ok">{has}</strong>
      {' · '}
      Нет отчёта: <strong className="miss">{miss}</strong>
    </p>
  )
}

export default function PeriodReportPage() {
  const [params] = useSearchParams()
  const defaults = defaultPeriodRange()
  const from = parseIso(params.get('from'), defaults.from)
  const to = parseIso(params.get('to'), defaults.to)
  const urlClientId = params.get('clientId') || ''
  const urlObjectId = params.get('objectId') || ''

  const [filters, setFilters] = useState<PeriodReportFilters>(() => {
    const base = loadPeriodFilters()
    if (urlClientId || urlObjectId) {
      return {
        ...base,
        clientId: urlClientId,
        objectId: urlObjectId,
      }
    }
    return base
  })
  const clients = useMemo(() => loadClients(), [])
  const objects = useMemo(() => {
    const c = clients.find((x) => x.id === filters.clientId)
    return c?.objects ?? []
  }, [clients, filters.clientId])

  useEffect(() => {
    savePeriodFilters(filters)
  }, [filters])

  const rows = useMemo(
    () =>
      buildPeriodReportRows(from, to, {
        clientId: filters.clientId || undefined,
        objectId: filters.objectId || undefined,
        reportPresence: filters.reportPresence,
        onlyInWork: filters.onlyInWork,
      }),
    [from, to, filters],
  )

  const scopedObjectLabel = useMemo(() => {
    if (!filters.clientId || !filters.objectId) return null
    const c = clients.find((x) => x.id === filters.clientId)
    const o = (c?.objects ?? []).find((x) => x.id === filters.objectId)
    return o?.address || o?.title || null
  }, [clients, filters.clientId, filters.objectId])

  useEffect(() => {
    const scope = scopedObjectLabel ? ` · ${scopedObjectLabel}` : ''
    document.title = `Сводный отчёт ${formatRuDate(from)}–${formatRuDate(to)}${scope} — СамоСтрой`
  }, [from, to, scopedObjectLabel])

  const generatedAt = todayIso()

  return (
    <div className="period-report">
      <style>{`
        .period-report {
          --ink: #1a1a1a;
          --text: #333;
          --muted: #666;
          --line: #d4d4d4;
          --ok: #047857;
          --miss: #be123c;
          font-family: "Segoe UI", system-ui, sans-serif;
          color: var(--text);
          background: #fff;
          min-height: 100vh;
          padding: 1rem 1.25rem 2rem;
        }
        .period-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .period-toolbar h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ink);
          flex: 1 1 auto;
        }
        .period-toolbar .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .period-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: var(--ink);
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.4rem 0.85rem;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
        }
        .period-btn--primary {
          background: #1d4ed8;
          border-color: #1d4ed8;
          color: #fff;
        }
        .period-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          align-items: end;
        }
        .period-filters label {
          font-size: 0.7rem;
          color: var(--muted);
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .period-filters select,
        .period-filters input[type="checkbox"] {
          font-size: 0.8rem;
        }
        .period-filters select {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 0.3rem 0.4rem;
          min-width: 9rem;
        }
        .period-meta {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .period-meta .ok { color: var(--ok); }
        .period-meta .miss { color: var(--miss); }
        .period-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 4px;
        }
        table.period-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          line-height: 1.35;
        }
        .period-table th,
        .period-table td {
          border: 1px solid var(--line);
          padding: 0.35rem 0.45rem;
          vertical-align: top;
          text-align: left;
        }
        .period-table th {
          background: #f3f4f6;
          color: var(--ink);
          font-weight: 600;
          white-space: nowrap;
        }
        .period-table td.num {
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .period-table td.date {
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .period-table tr.miss td.status {
          color: var(--miss);
          font-weight: 600;
        }
        .period-table tr.ok td.status {
          color: var(--ok);
          font-weight: 600;
        }
        .period-empty {
          margin: 2rem 0;
          color: var(--muted);
          font-size: 0.95rem;
        }
        .period-foot {
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: var(--muted);
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .period-report {
            padding: 0;
          }
          .period-toolbar .actions,
          .no-print {
            display: none !important;
          }
          .period-toolbar h1 {
            font-size: 12pt;
          }
          .period-table-wrap {
            border: none;
            overflow: visible;
          }
          table.period-table {
            font-size: 8pt;
          }
          .period-table th,
          .period-table td {
            padding: 2px 4px;
          }
          .period-table thead {
            display: table-header-group;
          }
          .period-table tr {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="period-toolbar">
        <h1>
          Сводный отчёт
          {scopedObjectLabel ? ` · ${scopedObjectLabel}` : ''} · {formatRuDate(from)} —{' '}
          {formatRuDate(to)}
        </h1>
        <div className="actions no-print">
          <button
            type="button"
            className="period-btn period-btn--primary"
            onClick={() => window.print()}
          >
            Печать / PDF
          </button>
          <Link to="/control" className="period-btn">
            ← К контролю
          </Link>
        </div>
      </div>

      <div className="period-filters no-print">
        <label>
          Клиент
          <select
            value={filters.clientId}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                clientId: e.target.value,
                objectId: '',
              }))
            }
          >
            <option value="">Все</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Объект
          <select
            value={filters.objectId}
            onChange={(e) => setFilters((f) => ({ ...f, objectId: e.target.value }))}
            disabled={!filters.clientId}
          >
            <option value="">Все</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.address || o.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Отчёт
          <select
            value={filters.reportPresence}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                reportPresence: e.target.value as PeriodReportFilters['reportPresence'],
              }))
            }
          >
            <option value="">Все дни</option>
            <option value="has">Только с отчётом</option>
            <option value="missing">Только без отчёта</option>
          </select>
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="checkbox"
            checked={filters.onlyInWork}
            onChange={(e) => setFilters((f) => ({ ...f, onlyInWork: e.target.checked }))}
          />
          Только «в работе»
        </label>
      </div>

      <SummaryStats rows={rows} />

      {rows.length === 0 ? (
        <p className="period-empty">
          Нет строк по фильтрам. Снимите фильтры или выберите другие даты / объекты «в работе».
        </p>
      ) : (
        <div className="period-table-wrap">
          <table className="period-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Объект</th>
                <th>Адрес</th>
                <th>Клиент</th>
                <th>Работник</th>
                <th>Сделано</th>
                <th>Проблемы</th>
                <th>Медиа</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.date}-${r.objectAddress}-${r.objectTitle}-${i}`}
                  className={r.status === 'есть' ? 'ok' : 'miss'}
                >
                  <td className="date">{formatRuDate(r.date)}</td>
                  <td>{escapeCell(r.objectTitle)}</td>
                  <td>{escapeCell(r.objectAddress)}</td>
                  <td>{escapeCell(r.clientName)}</td>
                  <td>{escapeCell(r.workerName)}</td>
                  <td>{escapeCell(r.workDone)}</td>
                  <td>{escapeCell(r.problems)}</td>
                  <td className="num">{r.mediaCount}</td>
                  <td className="status">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="period-foot">
        Сформировано {formatRuDate(generatedAt)}. Источник: локальные отчёты контроля объекта.
        В диалоге печати выберите «Сохранить как PDF».
      </p>
    </div>
  )
}

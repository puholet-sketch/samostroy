import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react'
import { getMediaBlob } from '../../lib/mediaStore'
import { fetchReportMediaRemote, isObjectReportsApiConfigured } from '../../lib/objectReportsApi'
import type { ReportMediaMeta } from '../../lib/objectReports'
import {
  buildWeeklyPack,
  shiftWeekSatFri,
  weekLabelRu,
  type WeeklyPack,
  type WeeklyPackDay,
  type WeeklyPackObjectSection,
} from '../../lib/weeklyPack'

type PackStyle = 'normal' | 'comic'

function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

/** «пн» → «Пн» */
function weekdayShortCap(weekdayRu: string): string {
  const t = weekdayRu.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function readPackStyle(raw: string | null): PackStyle {
  return raw === 'comic' ? 'comic' : 'normal'
}

type MediaLoadState = 'loading' | 'ready' | 'missing' | 'broken'

function useMediaUrl(mediaId: string) {
  const [url, setUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<MediaLoadState>('loading')
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!mediaId) {
      setUrl(null)
      setLoadState('missing')
      return
    }
    setLoadState('loading')
    ;(async () => {
      let blob = await getMediaBlob(mediaId)
      if (!blob && isObjectReportsApiConfigured()) {
        try {
          blob = await fetchReportMediaRemote(mediaId)
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      if (blob) {
        const next = URL.createObjectURL(blob)
        objectUrlRef.current = next
        setUrl(next)
        setLoadState('ready')
      } else {
        setUrl(null)
        setLoadState('missing')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  return { url, loadState, setLoadState }
}

function DayMediaNav({ day }: { day: WeeklyPackDay }) {
  const images = useMemo(
    () => day.media.filter((m) => m.kind === 'image'),
    [day.media],
  )
  const mediaKey = useMemo(() => images.map((m) => m.id).join('|'), [images])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [day.date, mediaKey])

  const safeIdx = images.length === 0 ? 0 : Math.min(idx, images.length - 1)
  const current = images[safeIdx]
  const { url, loadState, setLoadState } = useMediaUrl(current?.id ?? '')

  if (images.length === 0) {
    return <p className="text-xs text-gray-400 day-no-photo">Нет фото за день</p>
  }

  return (
    <div className="day-media mt-2">
      <div className="day-media-frame">
        {loadState === 'ready' && url ? (
          <img
            src={url}
            alt={current?.name || 'фото'}
            className="day-media-img"
            onError={() => setLoadState('broken')}
          />
        ) : (
          <div className="day-media-fallback">
            {loadState === 'loading' && 'Загрузка фото…'}
            {loadState === 'missing' &&
              'Медиа недоступно в этом браузере (нужен sync API / то же устройство)'}
            {loadState === 'broken' && 'Не удалось показать фото'}
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              className="day-media-nav day-media-nav--prev no-print"
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            >
              <RiArrowLeftSLine className="h-5 w-5 text-gray-800" />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              className="day-media-nav day-media-nav--next no-print"
              onClick={() => setIdx((i) => (i + 1) % images.length)}
            >
              <RiArrowRightSLine className="h-5 w-5 text-gray-800" />
            </button>
          </>
        )}
      </div>
      <p className="day-media-caption">
        {`Фото ${safeIdx + 1} / ${images.length}`}
        {current?.name ? ` · ${current.name}` : ''}
      </p>
    </div>
  )
}

function DaySection({ day }: { day: WeeklyPackDay }) {
  return (
    <section className={`day${!day.report ? ' miss' : ''}`}>
      <div className="day-head">
        <strong>{day.weekdayRu}</strong>
        <span className="tabular-nums text-sm text-gray-800 day-date">{formatRuDate(day.date)}</span>
        <span className={`badge ${day.report ? 'ok' : 'no'}`}>
          {day.report ? 'есть отчёт' : 'нет отчёта'}
        </span>
        {day.report?.workerName && (
          <span className="text-xs text-gray-500 day-worker">{day.report.workerName}</span>
        )}
      </div>
      {day.report ? (
        <>
          <p className="text-sm text-gray-800">
            <span className="text-xs font-medium text-gray-500">Сделано: </span>
            {day.shortWork || '—'}
          </p>
          {day.shortProblems && (
            <p className="mt-1 text-sm text-amber-900">
              <span className="text-xs font-medium text-amber-700">Проблемы: </span>
              {day.shortProblems}
            </p>
          )}
          <DayMediaNav day={day} />
        </>
      ) : (
        <p className="text-sm text-gray-400">Прораб не сдал дневной отчёт</p>
      )}
    </section>
  )
}

type ComicFrame = {
  key: string
  day: WeeklyPackDay
  image: ReportMediaMeta
  showBubbles: boolean
}

function collectComicFrames(section: WeeklyPackObjectSection): ComicFrame[] {
  const frames: ComicFrame[] = []
  for (const day of section.days) {
    const images = day.media.filter((m) => m.kind === 'image')
    if (images.length === 0) continue
    images.forEach((image, i) => {
      frames.push({
        key: `${section.objectId}:${day.date}:${image.id}`,
        day,
        image,
        showBubbles: i === 0,
      })
    })
  }
  return frames
}

function ComicPanel({
  day,
  image,
  showBubbles,
}: {
  day: WeeklyPackDay
  image: ReportMediaMeta
  showBubbles: boolean
}) {
  const { url, loadState, setLoadState } = useMediaUrl(image.id)
  const wd = weekdayShortCap(day.weekdayRu)

  return (
    <article className="comic-panel">
      <div className="comic-panel-frame">
        <span className="comic-panel-date" aria-label={`${wd} ${formatRuDate(day.date)}`}>
          {formatRuDate(day.date)}
          {wd ? ` · ${wd}` : ''}
        </span>
        {loadState === 'ready' && url ? (
          <img
            src={url}
            alt={image.name || `фото ${formatRuDate(day.date)}`}
            className="comic-panel-img"
            onError={() => setLoadState('broken')}
          />
        ) : (
          <div className="comic-panel-fallback">
            {loadState === 'loading' && 'Загрузка…'}
            {loadState === 'missing' && 'Фото недоступно'}
            {loadState === 'broken' && 'Ошибка фото'}
          </div>
        )}
        {showBubbles && (
          <div className="comic-panel-balloons">
            <div className="comic-balloon comic-balloon--done">
              <span className="comic-balloon-label">Сделано</span>
              <p>{day.shortWork || '—'}</p>
            </div>
            {day.shortProblems ? (
              <div className="comic-balloon comic-balloon--prob">
                <span className="comic-balloon-label">Проблемы</span>
                <p>{day.shortProblems}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}

function ComicStrip({ section }: { section: WeeklyPackObjectSection }) {
  const frames = useMemo(() => collectComicFrames(section), [section])

  if (frames.length === 0) {
    return (
      <p className="comic-empty">
        Нет фото за период — кадров для комикса нет. Переключитесь на «Обычный» или выберите другую
        неделю.
      </p>
    )
  }

  return (
    <div className="comic-strip" role="list">
      {frames.map((f) => (
        <div key={f.key} role="listitem">
          <ComicPanel day={f.day} image={f.image} showBubbles={f.showBubbles} />
        </div>
      ))}
    </div>
  )
}

function ObjectBlock({
  section,
  showHeading,
  packStyle,
}: {
  section: WeeklyPackObjectSection
  showHeading: boolean
  packStyle: PackStyle
}) {
  return (
    <div className="object-block">
      {showHeading && (
        <header className="object-head">
          <h2>{section.objectAddress || section.objectTitle}</h2>
          <p className="object-meta">
            Отчётов: {section.filledDays}/{section.days.length}
            {' · '}
            Медиа: {section.mediaTotal}
          </p>
        </header>
      )}
      {packStyle === 'comic' ? (
        <ComicStrip section={section} />
      ) : (
        section.days.map((day) => (
          <DaySection key={`${section.objectId}:${day.date}`} day={day} />
        ))
      )}
    </div>
  )
}

export default function WeeklyPackPage() {
  const [params, setSearchParams] = useSearchParams()
  const clientId = params.get('clientId') || ''
  const objectId = params.get('objectId') || ''
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const packStyle = readPackStyle(params.get('style'))

  const [pack, setPack] = useState<WeeklyPack | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.title =
      packStyle === 'comic'
        ? 'История ремонта · Комикс — СамоСтрой'
        : 'История ремонта — СамоСтрой'
  }, [packStyle])

  useEffect(() => {
    if (packStyle !== 'comic') return
    const href =
      'https://fonts.googleapis.com/css2?family=Exo+2:wght@500;700&family=Russo+One&display=swap'
    const existing = document.querySelector<HTMLLinkElement>('link[data-weekly-pack-comic-fonts="1"]')
    if (existing) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.weeklyPackComicFonts = '1'
    document.head.appendChild(link)
  }, [packStyle])

  useEffect(() => {
    if (!clientId) {
      setPack(null)
      setErr('Выберите клиента в Контроле и откройте «История ремонта»')
      return
    }
    let cancelled = false
    setBusy(true)
    setErr('')
    ;(async () => {
      try {
        const next = await buildWeeklyPack({
          clientId,
          objectId: objectId || undefined,
          from: fromParam || undefined,
          to: toParam || undefined,
        })
        if (cancelled) return
        if (!next) {
          setPack(null)
          setErr('Клиент не найден или нет объектов для истории ремонта')
          return
        }
        setPack(next)
        const anchorId = objectId || next.objects[0]?.objectId || ''
        if (next.from !== fromParam || next.to !== toParam || (!objectId && anchorId)) {
          setSearchParams(
            {
              clientId,
              ...(anchorId ? { objectId: anchorId } : {}),
              from: next.from,
              to: next.to,
              ...(packStyle === 'comic' ? { style: 'comic' } : {}),
            },
            { replace: true },
          )
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, objectId, fromParam, toParam, setSearchParams, packStyle])

  const multi = (pack?.objects.length ?? 0) > 1
  const sole = pack?.objects.length === 1 ? pack.objects[0] : null

  const title = useMemo(() => {
    if (!pack) return 'История ремонта'
    const week = weekLabelRu(pack.from, pack.to)
    if (multi) {
      return `${pack.clientName || 'Клиент'} · ${week}`
    }
    if (sole) {
      return `${sole.objectAddress || sole.objectTitle} · ${week}`
    }
    return `История ремонта · ${week}`
  }, [pack, multi, sole])

  const comicChapter = useMemo(() => {
    if (!pack) return { week: '', place: 'История ремонта' }
    const week = weekLabelRu(pack.from, pack.to)
    if (multi) return { week, place: pack.clientName || 'Клиент' }
    if (sole) return { week, place: sole.objectAddress || sole.objectTitle }
    return { week, place: pack.clientName || 'История ремонта' }
  }, [pack, multi, sole])

  function patchParams(nextStyle: PackStyle) {
    const next: Record<string, string> = {}
    if (clientId) next.clientId = clientId
    if (objectId) next.objectId = objectId
    if (fromParam) next.from = fromParam
    if (toParam) next.to = toParam
    if (nextStyle === 'comic') next.style = 'comic'
    setSearchParams(next, { replace: true })
  }

  function shiftWeek(delta: number) {
    if (!pack) return
    const next = shiftWeekSatFri(pack.from, delta)
    const primaryObjectId = pack.objects[0]?.objectId || objectId
    setSearchParams({
      clientId,
      ...(primaryObjectId ? { objectId: primaryObjectId } : {}),
      from: next.from,
      to: next.to,
      ...(packStyle === 'comic' ? { style: 'comic' } : {}),
    })
  }

  const rootClass = packStyle === 'comic' ? 'weekly-pack weekly-pack--comic' : 'weekly-pack'

  return (
    <div className={rootClass}>
      <style>{`
        .weekly-pack {
          --ink: #1a1a1a;
          --text: #333;
          --muted: #666;
          --line: #d4d4d4;
          font-family: "Segoe UI", system-ui, sans-serif;
          color: var(--text);
          background: #fff;
          min-height: 100vh;
          padding: 1rem 1.25rem 2.5rem;
        }
        .weekly-pack .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 1rem;
        }
        .weekly-pack .style-toggle {
          display: inline-flex;
          border: 1px solid #c4c4c4;
          border-radius: 6px;
          overflow: hidden;
          background: #fff;
        }
        .weekly-pack .style-toggle button {
          border: none;
          background: transparent;
          padding: 0.4rem 0.7rem;
          font-size: 0.8rem;
          cursor: pointer;
          color: #374151;
        }
        .weekly-pack .style-toggle button + button {
          border-left: 1px solid #c4c4c4;
        }
        .weekly-pack .style-toggle button.is-active {
          background: #111;
          color: #fff;
          font-weight: 600;
        }
        .weekly-pack h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 0.25rem;
        }
        .weekly-pack .meta {
          font-size: 0.8rem;
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .weekly-pack .object-block {
          margin-bottom: 1.5rem;
        }
        .weekly-pack .object-block + .object-block {
          padding-top: 1rem;
          border-top: 2px solid var(--ink);
        }
        .weekly-pack .object-head {
          margin-bottom: 0.75rem;
          break-after: avoid;
        }
        .weekly-pack .object-head h2 {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 0.2rem;
        }
        .weekly-pack .object-meta {
          font-size: 0.75rem;
          color: var(--muted);
          margin: 0;
        }
        .weekly-pack .day {
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin-bottom: 0.75rem;
          break-inside: avoid;
        }
        .weekly-pack .day.miss {
          background: #fafafa;
        }
        .weekly-pack .day-head {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: baseline;
          margin-bottom: 0.35rem;
        }
        .weekly-pack .day-head strong {
          color: var(--ink);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.04em;
        }
        .weekly-pack .badge {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
        }
        .weekly-pack .badge.ok { background: #d1fae5; color: #065f46; }
        .weekly-pack .badge.no { background: #ffe4e6; color: #9f1239; }
        .weekly-pack .day-media-frame {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 10rem;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: #f9fafb;
        }
        .weekly-pack .day-media-img {
          display: block;
          width: auto;
          max-width: 100%;
          height: auto;
          max-height: 20rem;
          object-fit: contain;
          border-radius: 4px;
        }
        .weekly-pack .day-media-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 10rem;
          padding: 1rem;
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
        }
        .weekly-pack .day-media-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.92);
          padding: 0.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          border: none;
          cursor: pointer;
        }
        .weekly-pack .day-media-nav:hover { background: #fff; }
        .weekly-pack .day-media-nav--prev { left: 0.25rem; }
        .weekly-pack .day-media-nav--next { right: 0.25rem; }
        .weekly-pack .day-media-caption {
          margin-top: 0.35rem;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
        }
        .weekly-pack .comic-poster { display: none; }
        .weekly-pack .comic-strip,
        .weekly-pack .comic-empty { display: none; }

        /* —— Comic strip (photo panels) —— */
        .weekly-pack--comic {
          --ink: #1a1208;
          --text: #1a1208;
          --muted: #5c4a32;
          --line: #1a1208;
          --comic-yellow: #ffd000;
          --comic-cream: #f7efe0;
          --comic-gutter: #f7efe0;
          --comic-bubble: #fffef9;
          font-family: "Exo 2", "Trebuchet MS", "Segoe UI", sans-serif;
          color: var(--text);
          background-color: var(--comic-cream);
          background-image:
            radial-gradient(circle at 1px 1px, rgba(26, 18, 8, 0.1) 1px, transparent 0);
          background-size: 8px 8px;
          padding: 1rem 1.1rem 2.75rem;
        }
        .weekly-pack--comic > * { position: relative; z-index: 1; }
        .weekly-pack--comic .style-toggle {
          border: 3px solid #1a1208;
          border-radius: 0;
          box-shadow: 3px 3px 0 #1a1208;
        }
        .weekly-pack--comic .style-toggle button.is-active {
          background: var(--comic-yellow);
          color: #1a1208;
        }
        .weekly-pack--comic .toolbar a,
        .weekly-pack--comic .toolbar > button:not(.style-toggle button) {
          border-radius: 0 !important;
          border: 2px solid #1a1208 !important;
          box-shadow: 2px 2px 0 #1a1208;
          font-weight: 700;
        }
        .weekly-pack--comic .toolbar > button.bg-emerald-600 {
          background: #0f9d9a !important;
          color: #fff !important;
        }
        .weekly-pack--comic h1.pack-title-normal { display: none; }
        .weekly-pack--comic .comic-poster {
          display: block;
          margin: 0.35rem 0 1rem;
          padding: 0.85rem 1rem 1rem;
          border: 4px solid #1a1208;
          background:
            linear-gradient(180deg, var(--comic-yellow) 0 56%, #0f9d9a 56% 100%);
          box-shadow: 6px 6px 0 #1a1208;
          break-inside: avoid;
          break-after: avoid;
        }
        .weekly-pack--comic .comic-poster-kicker {
          margin: 0 0 0.4rem;
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1a1208;
        }
        .weekly-pack--comic .comic-poster-title {
          margin: 0;
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: clamp(1.25rem, 3.2vw, 2rem);
          line-height: 1.05;
          text-transform: uppercase;
          color: #1a1208;
          text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.3);
        }
        .weekly-pack--comic .comic-poster-week {
          margin: 0.5rem 0 0;
          display: inline-block;
          padding: 0.2rem 0.55rem;
          background: #1a1208;
          color: var(--comic-yellow);
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: 0.8rem;
          letter-spacing: 0.03em;
        }
        .weekly-pack--comic .meta {
          color: #1a1208;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.78);
          border: 2px solid #1a1208;
          padding: 0.45rem 0.65rem;
        }
        .weekly-pack--comic .object-block + .object-block {
          border-top: 4px solid #1a1208;
          margin-top: 1.25rem;
        }
        .weekly-pack--comic .object-head h2 {
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: 1.05rem;
          text-transform: uppercase;
          background: var(--comic-yellow);
          display: inline-block;
          padding: 0.15rem 0.45rem;
          border: 2px solid #1a1208;
          box-shadow: 3px 3px 0 #1a1208;
        }
        .weekly-pack--comic .day { display: none; }

        .weekly-pack--comic .comic-empty {
          display: block;
          margin: 0.5rem 0 1rem;
          padding: 0.85rem 1rem;
          border: 3px solid #1a1208;
          background: #fff;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .weekly-pack--comic .comic-strip {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr));
          gap: 0.55rem;
          background: var(--comic-gutter);
          margin: 0.25rem 0 1rem;
        }

        .weekly-pack--comic .comic-panel {
          margin: 0;
          break-inside: avoid;
        }
        .weekly-pack--comic .comic-panel-frame {
          position: relative;
          aspect-ratio: 1 / 1;
          border: 3px solid #1a1208;
          background: #111;
          overflow: hidden;
          box-shadow: 2px 2px 0 rgba(26, 18, 8, 0.35);
        }
        .weekly-pack--comic .comic-panel-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .weekly-pack--comic .comic-panel-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 1rem;
          color: #d4d4d4;
          font-size: 0.8rem;
          text-align: center;
          background: #222;
        }
        .weekly-pack--comic .comic-panel-date {
          position: absolute;
          top: 0.4rem;
          left: 0.4rem;
          z-index: 3;
          padding: 0.18rem 0.45rem;
          background: rgba(255, 255, 255, 0.92);
          color: #1a1208;
          border: 2px solid #1a1208;
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: 0.68rem;
          letter-spacing: 0.04em;
          line-height: 1.2;
          max-width: calc(100% - 0.8rem);
        }

        .weekly-pack--comic .comic-panel-balloons {
          position: absolute;
          left: 0.4rem;
          right: 0.4rem;
          bottom: 0.4rem;
          z-index: 3;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          pointer-events: none;
        }
        .weekly-pack--comic .comic-balloon {
          position: relative;
          border: 2px solid #1a1208;
          background: var(--comic-bubble);
          padding: 0.4rem 0.55rem 0.45rem;
          border-radius: 1.15rem 1.15rem 1.15rem 0.35rem;
          box-shadow: 2px 2px 0 rgba(26, 18, 8, 0.55);
          max-height: 42%;
          overflow: hidden;
        }
        .weekly-pack--comic .comic-balloon::after {
          content: "";
          position: absolute;
          left: 0.85rem;
          bottom: -0.42rem;
          width: 0;
          height: 0;
          border-left: 0.35rem solid transparent;
          border-right: 0.45rem solid transparent;
          border-top: 0.45rem solid #1a1208;
        }
        .weekly-pack--comic .comic-balloon::before {
          content: "";
          position: absolute;
          left: 0.92rem;
          bottom: -0.28rem;
          width: 0;
          height: 0;
          border-left: 0.28rem solid transparent;
          border-right: 0.36rem solid transparent;
          border-top: 0.36rem solid var(--comic-bubble);
          z-index: 1;
        }
        .weekly-pack--comic .comic-balloon--prob {
          background: #fff3d0;
          border-radius: 0.35rem 1.15rem 1.15rem 1.15rem;
          align-self: flex-end;
          max-width: 92%;
        }
        .weekly-pack--comic .comic-balloon--prob::after {
          left: auto;
          right: 0.85rem;
        }
        .weekly-pack--comic .comic-balloon--prob::before {
          left: auto;
          right: 0.92rem;
          border-top-color: #fff3d0;
        }
        .weekly-pack--comic .comic-balloon-label {
          display: inline-block;
          margin-bottom: 0.15rem;
          padding: 0.04rem 0.35rem;
          font-family: "Russo One", Impact, "Arial Black", sans-serif;
          font-size: 0.58rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: #1a1208;
          color: var(--comic-yellow);
        }
        .weekly-pack--comic .comic-balloon--prob .comic-balloon-label {
          background: #9a3412;
          color: #fff;
        }
        .weekly-pack--comic .comic-balloon p {
          margin: 0;
          font-size: 0.72rem;
          line-height: 1.25;
          font-weight: 700;
          color: #3b1d0f;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 720px) {
          .weekly-pack--comic .comic-strip {
            grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr));
            gap: 0.65rem;
          }
        }

        @media print {
          .weekly-pack .no-print { display: none !important; }
          .weekly-pack { padding: 0; }
          .weekly-pack .object-block + .object-block {
            break-before: page;
            border-top: none;
            padding-top: 0;
          }
          .weekly-pack .day-media-frame {
            min-height: 0;
            break-inside: avoid;
          }
          .weekly-pack .day-media-img {
            max-height: 14rem;
          }
          .weekly-pack--comic {
            background: #f7efe0 !important;
            background-image: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .weekly-pack--comic .comic-poster {
            box-shadow: none;
            break-after: avoid;
          }
          .weekly-pack--comic .comic-strip {
            gap: 0.4rem;
            grid-template-columns: repeat(2, 1fr);
          }
          .weekly-pack--comic .comic-panel-frame {
            box-shadow: none;
            break-inside: avoid;
          }
          .weekly-pack--comic .comic-balloon p {
            -webkit-line-clamp: 4;
          }
          .weekly-pack--comic .object-block + .object-block {
            border-top: none;
          }
        }
      `}</style>

      <div className="toolbar no-print">
        <Link
          to="/control"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
        >
          ← Контроль
        </Link>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => shiftWeek(-1)}
          disabled={!pack}
        >
          ← Нед.
        </button>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => shiftWeek(1)}
          disabled={!pack}
        >
          Нед. →
        </button>
        <div className="style-toggle" role="group" aria-label="Стиль истории">
          <button
            type="button"
            className={packStyle === 'normal' ? 'is-active' : undefined}
            onClick={() => patchParams('normal')}
          >
            Обычный
          </button>
          <button
            type="button"
            className={packStyle === 'comic' ? 'is-active' : undefined}
            onClick={() => patchParams('comic')}
          >
            Комикс
          </button>
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          onClick={() => window.print()}
          disabled={!pack}
        >
          Печать / PDF
        </button>
      </div>

      {packStyle === 'comic' ? (
        <header className="comic-poster">
          <p className="comic-poster-kicker">
            СамоСтрой · История ремонта
            {comicChapter.week ? ` · ${comicChapter.week}` : ''}
          </p>
          <h1 className="comic-poster-title">{comicChapter.place}</h1>
          {comicChapter.week ? (
            <p className="comic-poster-week">{comicChapter.week}</p>
          ) : null}
        </header>
      ) : (
        <h1 className="pack-title-normal">{title}</h1>
      )}

      {pack && (
        <p className="meta">
          Клиент: <strong>{pack.clientName || '—'}</strong>
          {' · '}
          Период сб→пт (день отчёта — пятница {formatRuDate(pack.reportDay)})
          {multi ? (
            <>
              {' · '}
              Объектов: {pack.objects.length}
            </>
          ) : null}
          {' · '}
          Отчётов: {pack.filledDays}/
          {pack.objects.reduce((s, o) => s + o.days.length, 0)}
          {' · '}
          Медиа: {pack.mediaTotal}
          {packStyle === 'comic' ? ' · режим: комикс' : null}
        </p>
      )}

      {busy && <p className="text-sm text-gray-500">Собираем историю…</p>}
      {err && !busy && <p className="text-sm text-rose-700">{err}</p>}

      {pack &&
        pack.objects.map((section) => (
          <ObjectBlock
            key={section.objectId}
            section={section}
            showHeading={multi}
            packStyle={packStyle}
          />
        ))}
    </div>
  )
}

import type { FeedbackMarker } from './feedbackStore'

/** Рисует метки поверх исходного PNG → новый Blob. */
export async function composeAnnotatedPng(
  source: Blob,
  markers: FeedbackMarker[],
): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const W = canvas.width
  const H = canvas.height
  ctx.lineWidth = Math.max(2, Math.round(W / 400))
  ctx.font = `bold ${Math.max(12, Math.round(W / 45))}px sans-serif`

  markers.forEach((m, idx) => {
    const color = '#C00000'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    const n = m.label || String(idx + 1)

    if (m.type === 'rect' && m.w != null && m.h != null) {
      const x = (m.x / 100) * W
      const y = (m.y / 100) * H
      const w = (m.w / 100) * W
      const h = (m.h / 100) * H
      ctx.strokeRect(x, y, w, h)
      drawBadge(ctx, x, y, n)
    } else if (m.type === 'arrow' && m.x2 != null && m.y2 != null) {
      const x1 = (m.x / 100) * W
      const y1 = (m.y / 100) * H
      const x2 = (m.x2 / 100) * W
      const y2 = (m.y2 / 100) * H
      drawArrow(ctx, x1, y1, x2, y2)
      drawBadge(ctx, x1, y1, n)
    } else if (m.type === 'text') {
      const x = (m.x / 100) * W
      const y = (m.y / 100) * H
      drawBadge(ctx, x, y, n)
      if (m.note) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        const pad = 4
        const tw = ctx.measureText(m.note).width
        ctx.fillRect(x + 18, y - 14, tw + pad * 2, 20)
        ctx.fillStyle = color
        ctx.fillText(m.note, x + 18 + pad, y + 2)
      }
    } else {
      const x = (m.x / 100) * W
      const y = (m.y / 100) * H
      drawPin(ctx, x, y, n)
    }
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
): void {
  const r = Math.max(10, ctx.lineWidth * 5)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y + 0.5)
  ctx.fillStyle = '#C00000'
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
): void {
  drawBadge(ctx, x, y, label)
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.max(10, ctx.lineWidth * 6)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(angle - 0.4), y2 - head * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - head * Math.cos(angle + 0.4), y2 - head * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

import { renderAsync } from 'docx-preview'
import html2pdf from 'html2pdf.js'

/** DOCX blob → multi-page A4 PDF download (same layout as generated contract). */
export async function downloadPdfFromDocxBlob(docxBlob: Blob, filename: string): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('data-docx-pdf-host', '1')
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:794px;background:#fff;color:#111;z-index:-1;pointer-events:none;'
  document.body.appendChild(host)
  try {
    await renderAsync(await docxBlob.arrayBuffer(), host, undefined, {
      className: 'docx-pdf-preview',
      inWrapper: false,
      ignoreWidth: false,
      breakPages: true,
    })
    const opt = {
      margin: [12, 12, 14, 12] as [number, number, number, number],
      filename: filename.replace(/\.docx$/i, '.pdf'),
      image: { type: 'jpeg' as const, quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] as const },
    }
    await html2pdf().set(opt).from(host).save()
  } finally {
    host.remove()
  }
}

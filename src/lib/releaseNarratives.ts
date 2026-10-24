/**
 * Бизнес-описания релизов: `data/releases/<id>.md` (raw через Vite).
 * Id файла = id релиза в changelog.json.
 */
const rawModules = import.meta.glob('@data/releases/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function idFromPath(path: string): string {
  const m = path.replace(/\\/g, '/').match(/\/([^/]+)\.md$/)
  return m ? m[1] : ''
}

const BY_ID: Record<string, string> = {}
for (const [path, body] of Object.entries(rawModules)) {
  const id = idFromPath(path)
  if (id && typeof body === 'string') BY_ID[id] = body
}

/** Markdown-текст бизнес-описания релиза или undefined, если файла нет */
export function getReleaseNarrative(releaseId: string): string | undefined {
  const t = BY_ID[releaseId]
  return t?.trim() ? t : undefined
}

export function listNarrativeIds(): string[] {
  return Object.keys(BY_ID)
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { source: string; className?: string }

/** Минимальный markdown: заголовки, списки, абзацы, ссылки, **жирный**, `код`. */
export function MarkdownBody({ source, className }: Props) {
  const blocks = splitBlocks(source.trim())
  return (
    <div className={className ?? 'space-y-3 text-sm leading-relaxed text-gray-700'}>
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  )
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'p'; text: string }

function splitBlocks(src: string): Block[] {
  const lines = src.split(/\r?\n/)
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    const hm = /^(#{1,3})\s+(.+)$/.exec(line)
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3
      out.push({ type: (`h${level}` as 'h1' | 'h2' | 'h3'), text: hm[2].trim() })
      i += 1
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '').trim())
        i += 1
      }
      out.push({ type: 'ul', items })
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !/^[-*]\s+/.test(lines[i])) {
      para.push(lines[i].trim())
      i += 1
    }
    out.push({ type: 'p', text: para.join(' ') })
  }
  return out
}

function Block({ block }: { block: Block }) {
  if (block.type === 'h1') {
    return <h2 className="text-lg font-semibold text-gray-900">{inlineMd(block.text)}</h2>
  }
  if (block.type === 'h2') {
    return <h3 className="pt-1 text-base font-semibold text-gray-900">{inlineMd(block.text)}</h3>
  }
  if (block.type === 'h3') {
    return <h4 className="text-sm font-semibold text-gray-800">{inlineMd(block.text)}</h4>
  }
  if (block.type === 'ul') {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {block.items.map((it, i) => (
          <li key={i}>{inlineMd(it)}</li>
        ))}
      </ul>
    )
  }
  return <p>{inlineMd(block.text)}</p>
}

function inlineMd(text: string): ReactNode {
  const nodes: ReactNode[] = []
  // [text](url) | **bold** | `code`
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(<InlineLink key={key++} href={m[3]} label={m[2]} />)
    } else if (m[4]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {m[5]}
        </strong>,
      )
    } else if (m[6]) {
      nodes.push(
        <code key={key++} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">
          {m[7]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length === 1 ? nodes[0] : <>{nodes}</>
}

function InlineLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className="font-medium text-blue-700 hover:underline">
        {label}
      </Link>
    )
  }
  return (
    <a href={href} className="font-medium text-blue-700 hover:underline" target="_blank" rel="noreferrer">
      {label}
    </a>
  )
}

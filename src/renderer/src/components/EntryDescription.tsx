import type { ReactNode } from 'react'
import { countEntryUnits } from '../../../shared/sheet-layout'

export function cleanEntryText(text: string): string {
  return text.replace(/\{@\w+\s([^|}]+)(?:\|[^}]*)?\}/g, '$1')
}

export function formatEntriesAsNodes(entries: unknown): ReactNode {
  if (!Array.isArray(entries)) return null
  return entries.map((entry, index) => formatEntryNode(entry, index))
}

function formatEntryNode(entry: unknown, index: number): ReactNode {
  if (typeof entry === 'string') {
    const text = cleanEntryText(entry).trim()
    if (!text) return null
    return (
      <p key={index} className="detail-paragraph">
        {text}
      </p>
    )
  }
  if (!entry || typeof entry !== 'object') return null

  const obj = entry as Record<string, unknown>

  if (obj.type === 'list' && Array.isArray(obj.items)) {
    return (
      <ul key={index} className="detail-list">
        {obj.items.map((item, i) => (
          <li key={i}>{formatEntryNode(item, i)}</li>
        ))}
      </ul>
    )
  }

  if (obj.type === 'item') {
    const body = obj.entry ?? obj.entries
    return (
      <div key={index} className="detail-list-item">
        {obj.name ? <strong>{String(obj.name)} </strong> : null}
        {typeof body === 'string' ? cleanEntryText(body) : formatEntriesAsNodes(body)}
      </div>
    )
  }

  if (obj.type === 'entries' && obj.name) {
    return (
      <div key={index} className="detail-subsection">
        <h4>{String(obj.name)}</h4>
        {formatEntriesAsNodes(obj.entries)}
      </div>
    )
  }

  if (obj.entries) {
    return (
      <div key={index} className="detail-subsection">
        {obj.name ? <h4>{String(obj.name)}</h4> : null}
        {formatEntriesAsNodes(obj.entries)}
      </div>
    )
  }

  if (obj.items) {
    return <div key={index}>{formatEntriesAsNodes(obj.items)}</div>
  }

  return null
}

export function EntryDescription({ detail }: { detail: Record<string, unknown> | null }) {
  if (!detail) {
    return <p className="detail-no-content">Select an option to view its description.</p>
  }

  const blocks: ReactNode[] = []

  if (Array.isArray(detail.entries)) {
    blocks.push(
      <div key="entries" className="detail-block">
        {formatEntriesAsNodes(detail.entries)}
      </div>
    )
  }

  if (Array.isArray(detail.entriesHigherLevel) && countEntryUnits(detail.entriesHigherLevel) > 0) {
    blocks.push(
      <div key="higher" className="detail-block detail-block-higher">
        <h4>At Higher Levels</h4>
        {formatEntriesAsNodes(detail.entriesHigherLevel)}
      </div>
    )
  }

  if (!blocks.length) {
    return <p className="detail-no-content">No description available.</p>
  }

  return <div className="detail-description">{blocks}</div>
}

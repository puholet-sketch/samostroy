import type { IssueType } from '../../services/types'
import { ISSUE_TYPE_BADGE, ISSUE_TYPE_LABEL } from '../../lib/issues'

export default function IssueTypeBadge({ type }: { type: IssueType }) {
  return <span className={ISSUE_TYPE_BADGE[type]}>{ISSUE_TYPE_LABEL[type]}</span>
}

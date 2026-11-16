import { Badge } from './ui';
import { statusLabel } from '@/lib/workflow';

const TONE = { submitted: 'slate', ai_completed: 'violet', draft_generated: 'violet', assigned: 'sky', under_review: 'amber', awaiting_approval: 'amber', response_issued: 'green', rejected: 'rose', closed: 'slate' };
export const StatusBadge = ({ status }) => <Badge tone={TONE[status] || 'navy'}>{statusLabel(status)}</Badge>;
export const STATUS_OPTIONS = ['submitted', 'ai_completed', 'draft_generated', 'assigned', 'under_review', 'awaiting_approval', 'response_issued', 'rejected', 'closed'];

// Application status model and allowed transitions (pure, shared by server and UI).
export const STATUS_LABELS = {
  submitted: 'Submitted',
  ai_completed: 'AI Analysis Completed',
  draft_generated: 'Draft Generated',
  assigned: 'Assigned',
  under_review: 'Under Review',
  awaiting_approval: 'Awaiting Approval',
  response_issued: 'Response Issued',
  rejected: 'Rejected',
  closed: 'Closed',
};
export const STATUS_ORDER = ['submitted', 'ai_completed', 'draft_generated', 'assigned', 'under_review', 'awaiting_approval', 'response_issued', 'closed'];

export const TRANSITIONS = {
  submitted: ['ai_completed'],
  ai_completed: ['draft_generated', 'assigned'],
  draft_generated: ['assigned'],
  assigned: ['under_review', 'rejected'],
  under_review: ['awaiting_approval', 'rejected', 'assigned'],
  awaiting_approval: ['response_issued', 'rejected', 'under_review', 'assigned'],
  response_issued: ['closed'],
  rejected: ['closed'],
  closed: [],
};
export const TERMINAL = ['response_issued', 'rejected', 'closed'];
export const OPEN_FOR_OFFICER = ['assigned', 'under_review', 'awaiting_approval'];

export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
export const statusLabel = (s) => STATUS_LABELS[s] || s;

export const CATEGORIES = ['Education', 'Healthcare', 'Transportation', 'Infrastructure', 'Public administration', 'Electricity', 'Water supply', 'Agriculture', 'Municipal services', 'Other'];

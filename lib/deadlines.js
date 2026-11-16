// Response deadlines and explainable priority rules (pure functions, no I/O).
const DAY = 864e5;
const DONE = ['response_issued', 'rejected', 'closed'];

export function deadlineInfo(app, days = 30, now = new Date()) {
  const dueAt = new Date(new Date(app.createdAt).getTime() + days * DAY);
  if (DONE.includes(app.status)) {
    const at = app.respondedAt ? new Date(app.respondedAt) : new Date(app.updatedAt);
    return { dueAt: dueAt.toISOString(), daysLeft: null, state: 'done', metOnTime: at <= dueAt };
  }
  const daysLeft = Math.ceil((dueAt - now) / DAY);
  return { dueAt: dueAt.toISOString(), daysLeft, state: daysLeft < 0 ? 'overdue' : daysLeft <= 5 ? 'due_soon' : 'on_track' };
}

const URGENT = /\b(life|liberty|arrest|detention|custody|emergency|danger|threat)\b/i;

// Every rule contributes points AND a human-readable reason, so officers can see why an item is ranked where it is.
export function priorityFor(app, days = 30, now = new Date()) {
  if (DONE.includes(app.status)) return { level: 'none', score: 0, reasons: [] };
  const d = deadlineInfo(app, days, now); const reasons = []; let score = 0;
  if (d.state === 'overdue') { score += 50; reasons.push(`Overdue by ${Math.abs(d.daysLeft)} day${Math.abs(d.daysLeft) === 1 ? '' : 's'}`); }
  else if (d.daysLeft <= 5) { score += 30; reasons.push(`Due in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`); }
  else if (d.daysLeft <= 10) { score += 10; reasons.push(`Due in ${d.daysLeft} days`); }
  if (URGENT.test(`${app.subject} ${app.description}`)) { score += 40; reasons.push('Mentions life or liberty keywords: check whether an expedited timeline applies'); }
  if (app.status === 'awaiting_approval') { score += 15; reasons.push('Draft is waiting for approval'); }
  if (app.status === 'assigned') { score += 5; reasons.push('Review not started'); }
  const top = app.aiAnalysis?.similar_records?.[0]?.similarity;
  if (top !== undefined && top < 0.2) { score += 5; reasons.push('No close historical precedent found'); }
  return { level: score >= 50 ? 'high' : score >= 20 ? 'medium' : 'normal', score, reasons };
}

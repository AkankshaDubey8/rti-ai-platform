// Response quality checklist. Every item must be ticked by the assigned officer before a draft can be approved (enforced server-side).
export const CHECKLIST = [
  { key: 'answered_each', label: 'Every requested item is answered, or clearly marked as not available' },
  { key: 'verified_facts', label: 'All facts are verified against current official records, not only historical records' },
  { key: 'exemptions', label: 'Any information withheld states a lawful ground that I have reviewed' },
  { key: 'personal_data', label: 'No third-party personal data is disclosed by mistake' },
  { key: 'appeal_info', label: 'Appeal and fee information is confirmed for this department' },
  { key: 'tone', label: 'Language is clear and polite, with no leftover AI template wording' },
];
export const checklistComplete = (c = {}) => CHECKLIST.every((i) => c[i.key] === true);
export const missingChecklist = (c = {}) => CHECKLIST.filter((i) => c[i.key] !== true).map((i) => i.label);

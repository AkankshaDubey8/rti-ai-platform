import { AlertTriangle, Bot, Building2, Cpu, FileSearch, Tag } from 'lucide-react';
import { Badge, Card, CardHeader } from './ui';

const isFallback = (engine) => engine === 'local-js-fallback';

// Shows what the AI suggested. `staff` adds similar records and similarity scores; citizens only see category and routing.
export default function AnalysisPanel({ analysis, staff }) {
  if (!analysis) return <Card className="p-6 text-sm text-navy-500">AI analysis has not run for this application yet.</Card>;
  const c = staff ? analysis.classification : analysis;
  const dept = staff ? analysis.department_recommendation : null;
  const category = staff ? c.category : analysis.category;
  const keywords = staff ? c.keywords : analysis.keywords;
  const explanation = staff ? c.explanation : analysis.explanation;
  const engine = analysis.engine;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <Bot className="h-4 w-4 shrink-0" aria-hidden />
        <span><strong>AI suggestion, not verified information.</strong> An authorised officer reviews everything before a response is issued.</span>
      </div>
      {staff && (isFallback(engine) || analysis.fallback_reason) && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{analysis.fallback_reason || 'The local fallback engine produced this analysis.'} Keyword matching and TF-IDF were used instead of the MiniLM embedding model.</span></div>
      )}
      <Card>
        <CardHeader title="Category" subtitle={staff ? 'Classification approach is documented in the README' : undefined} />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2"><Tag className="h-4 w-4 text-brand-600" aria-hidden /><span className="text-xl font-semibold">{category}</span>
            {staff && <Badge tone="slate">{c.method}</Badge>}{staff && <Badge tone="slate">score {c.score}</Badge>}</div>
          <p className="text-sm text-navy-700">{explanation}</p>
          {keywords?.length > 0 && <div className="flex flex-wrap gap-1.5">{keywords.map((k) => <Badge key={k} tone="teal">{k}</Badge>)}</div>}
          {staff && <p className="text-xs text-navy-500">{c.score_type}. Other candidates: {c.top_categories?.map((t) => `${t.category} (${t.score})`).join(', ')}</p>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Suggested department" />
        <div className="space-y-2 p-5 text-sm">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-600" aria-hidden /><span className="text-lg font-semibold">{(staff ? dept?.recommended?.name : analysis.recommendedDepartment) || 'No recommendation'}</span></div>
          <p className="text-navy-700">{staff ? dept?.reason : analysis.departmentReason}</p>
          {staff && dept?.alternatives?.length > 0 && <p className="text-navy-500">Alternatives: {dept.alternatives.map((a) => a.name).join(', ')}</p>}
          {staff && analysis.override && <p className="rounded-lg bg-amber-50 p-2.5 text-amber-900">Overridden by {analysis.override.by} to {analysis.override.toName}{analysis.override.note ? `: ${analysis.override.note}` : ''}.</p>}
        </div>
      </Card>
      {staff && (
        <Card>
          <CardHeader title="Similar historical records" subtitle={analysis.search?.method} />
          <div className="divide-y divide-navy-50">
            {analysis.similar_records?.length ? analysis.similar_records.map((r) => (
              <div key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-navy-400" aria-hidden /><span className="font-semibold">{r.title}</span></div>
                  <Badge tone="teal">similarity {r.similarity}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy-500"><span>{r.record_id} (DEMO DATA)</span><span>{r.category}</span><span>{r.department}</span></div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, Math.min(100, r.similarity * 100))}%` }} /></div>
                <p className="mt-3 text-sm text-navy-800"><span className="font-medium">Relevant extract: </span>{r.extracted_information}</p>
              </div>
            )) : <p className="p-5 text-sm text-navy-500">No historical records were available to search.</p>}
          </div>
          <p className="border-t border-navy-100 px-5 py-3 text-xs text-navy-500">{analysis.search?.note}</p>
        </Card>
      )}
      <p className="flex items-center gap-1.5 text-xs text-navy-500"><Cpu className="h-3.5 w-3.5" aria-hidden />Engine: {engine === 'python-fastapi' ? 'Python AI service' : 'local fallback'}{analysis.analyzedAt ? `, analysed ${new Date(analysis.analyzedAt).toLocaleString('en-IN')}` : ''}</p>
    </div>
  );
}

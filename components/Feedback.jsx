'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from './Toast';
import { Button, Card, CardHeader, Textarea } from './ui';

// Citizen rating + comment once a request has a response. One per application; can be edited.
export default function Feedback({ application, onSaved }) {
  const { toast } = useToast(); const a = application;
  const [rating, setRating] = useState(a.feedback?.rating || 0); const [comment, setComment] = useState(a.feedback?.comment || ''); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api(`/api/applications/${a.applicationId}/feedback`, { method: 'POST', body: { rating, comment } }); toast('Thank you for your feedback.'); onSaved?.(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } }
  return (
    <Card>
      <CardHeader title="How was this response?" subtitle="Your rating helps administrators improve the service. It is shown only as an anonymous average." />
      <div className="space-y-4 p-5">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="rounded-lg p-1.5 hover:bg-navy-100"><Star className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-navy-300'}`} /></button>))}</div>
        <Textarea rows={3} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" aria-label="Comment" />
        <Button onClick={save} loading={busy} disabled={!rating}>{a.feedback ? 'Update feedback' : 'Send feedback'}</Button>
      </div>
    </Card>
  );
}

'use client';

export function RowEditor({ kind, index, count, value, onChange, onRemove, onMove, needsReview, inputId }: {
  kind: 'ingredient' | 'step'; index: number; count: number; value: string;
  onChange: (value: string) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void;
  needsReview?: boolean; inputId: string;
}) {
  const label = `${kind === 'ingredient' ? 'Ingredient' : 'Step'} ${index + 1}`;
  return <div className="rounded-xl border border-white/10 bg-black/10 p-3 sm:p-4">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
      {needsReview && <span className="text-xs text-purple-200">Needs review</span>}
    </div>
    <textarea id={inputId} value={value} onChange={(event) => onChange(event.target.value)} required rows={kind === 'step' ? 3 : 2} placeholder={kind === 'ingredient' ? '2 cloves garlic, minced' : 'What happens next?'} />
    <div className="mt-2 flex items-center gap-2">
      <button type="button" className="btn" aria-label={`Move ${label.toLowerCase()} up`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
      <button type="button" className="btn" aria-label={`Move ${label.toLowerCase()} down`} disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
      <button type="button" className="btn ml-auto text-rose-200" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>Remove</button>
    </div>
  </div>;
}

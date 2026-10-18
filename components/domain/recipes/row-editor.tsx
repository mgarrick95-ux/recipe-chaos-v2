'use client';

export function RowEditor({ kind, index, count, value, onChange, onRemove, onMove, needsReview, inputId }: {
  kind: 'ingredient' | 'step'; index: number; count: number; value: string;
  onChange: (value: string) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void;
  needsReview?: boolean; inputId: string;
}) {
  const label = `${kind === 'ingredient' ? 'Ingredient' : 'Step'} ${index + 1}`;
  return <div className="recipe-row">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
      {needsReview && <span className="text-xs font-medium text-purple-200">Needs review</span>}
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" className="row-control" aria-label={`Move ${label.toLowerCase()} up`} title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="row-control" aria-label={`Move ${label.toLowerCase()} down`} title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
        <button type="button" className="row-control row-control-danger" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>Remove</button>
      </div>
    </div>
    <textarea className={kind === 'ingredient' ? 'compact-textarea' : 'step-textarea'} id={inputId} value={value} onChange={(event) => onChange(event.target.value)} required rows={kind === 'step' ? 2 : 1} placeholder={kind === 'ingredient' ? '2 cloves garlic, minced' : 'What happens next?'} />
  </div>;
}

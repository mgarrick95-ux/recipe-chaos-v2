'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addShoppingAction, checkShoppingAction, clearCheckedShoppingAction,
  editShoppingAction, removeShoppingAction,
} from '@/app/shopping/actions';
import { shoppingToInput } from '@/domain/shopping/manual-entry';
import type { ShoppingInput, ShoppingItem } from '@/domain/shopping/types';

const intentions: Record<ShoppingInput['intention'], string> = {
  general: 'General', this_week: 'For this week', staple: 'Staple',
};

function sameName(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === b.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function quantityLabel(item: ShoppingItem): string {
  return item.quantity === null ? '' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
}

export function ShoppingList({ initialItems }: { initialItems: ShoppingItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [previousInitialItems, setPreviousInitialItems] = useState(initialItems);
  if (initialItems !== previousInitialItems) {
    setPreviousInitialItems(initialItems);
    setItems(initialItems);
  }
  const [newFields, setNewFields] = useState<ShoppingInput>(() => shoppingToInput());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<ShoppingInput>(() => shoppingToInput());
  const [duplicate, setDuplicate] = useState<ShoppingItem | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function resetMessages() { setError(''); setNotice(''); }

  function persistNew() {
    resetMessages();
    startTransition(async () => {
      const result = await addShoppingAction(newFields);
      if (!result.ok) { setError(result.error.message); return; }
      setItems(current => [...current, result.data]);
      setNewFields(shoppingToInput());
      setDuplicate(null);
      router.refresh();
    });
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    const existing = items.find(item => !item.isChecked && sameName(item.displayName, newFields.displayName));
    if (existing) { setDuplicate(existing); return; }
    persistNew();
  }

  function startEdit(item: ShoppingItem) {
    resetMessages();
    setDuplicate(null);
    setEditingId(item.id);
    setEditFields(shoppingToInput(item));
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>, item: ShoppingItem) {
    event.preventDefault();
    resetMessages();
    startTransition(async () => {
      const result = await editShoppingAction(item.id, item.updatedAt, editFields);
      if (!result.ok) { setError(result.error.message); return; }
      setItems(current => current.map(candidate => candidate.id === item.id ? result.data : candidate));
      setEditingId(null);
      router.refresh();
    });
  }

  function toggle(item: ShoppingItem) {
    resetMessages();
    startTransition(async () => {
      const result = await checkShoppingAction(item.id, item.updatedAt, !item.isChecked);
      if (!result.ok) { setError(result.error.message); return; }
      setItems(current => current.map(candidate => candidate.id === item.id ? result.data : candidate));
      router.refresh();
    });
  }

  function remove(item: ShoppingItem) {
    if (!window.confirm(`Remove ${item.displayName} from your shopping list?`)) return;
    resetMessages();
    startTransition(async () => {
      const result = await removeShoppingAction(item.id, item.updatedAt, true);
      if (!result.ok) { setError(result.error.message); return; }
      setItems(current => current.filter(candidate => candidate.id !== item.id));
      setEditingId(null);
      router.refresh();
    });
  }

  function clearChecked() {
    if (!window.confirm('Clear all checked items from your shopping list?')) return;
    resetMessages();
    startTransition(async () => {
      const result = await clearCheckedShoppingAction(true);
      if (!result.ok) { setError(result.error.message); return; }
      setItems(current => current.filter(item => !item.isChecked));
      setNotice(result.data.count === 0 ? 'There were no checked items to clear.' : `Cleared ${result.data.count} checked ${result.data.count === 1 ? 'item' : 'items'}.`);
      router.refresh();
    });
  }

  const active = items.filter(item => !item.isChecked);
  const checked = items.filter(item => item.isChecked);

  return <div className="space-y-7">
    <section className="panel space-y-5" aria-labelledby="add-shopping-title">
      <div>
        <h2 id="add-shopping-title" className="section-title">Add to the list</h2>
        <p className="muted mt-1 text-sm">Just the name is fine. Add an amount if it helps.</p>
      </div>
      <form onSubmit={add} className="space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(6rem,1fr)]">
          <div><label className="field-label" htmlFor="shopping-name">What do we need?</label><input id="shopping-name" value={newFields.displayName} required maxLength={240} placeholder="Milk, apples, rice…" onChange={e => { setNewFields(current => ({ ...current, displayName: e.target.value })); setDuplicate(null); }} /></div>
          <div><label className="field-label" htmlFor="shopping-quantity">Amount</label><input id="shopping-quantity" type="number" min="0" step="any" value={newFields.quantity} placeholder="2" onChange={e => setNewFields(current => ({ ...current, quantity: e.target.value }))} /></div>
          <div><label className="field-label" htmlFor="shopping-unit">Unit</label><input id="shopping-unit" maxLength={80} value={newFields.unit} placeholder="bags" onChange={e => setNewFields(current => ({ ...current, unit: e.target.value }))} /></div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="field-label" htmlFor="shopping-intention">For</label><select id="shopping-intention" className="rounded-[.65rem] border border-[#455452] bg-[#111a19] px-4 py-3" value={newFields.intention} disabled={pending} onChange={e => setNewFields(current => ({ ...current, intention: e.target.value as ShoppingInput['intention'] }))}>{Object.entries(intentions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Adding…' : '+ Add item'}</button>
        </div>
      </form>
      {duplicate && <div className="rounded-[.8rem] border border-purple-300/30 bg-purple-300/[.07] p-4" role="status">
        <p className="font-medium">{duplicate.displayName} is already on your list.</p>
        <p className="muted mt-1 text-sm">You can edit that item or keep both separate.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="btn" type="button" onClick={() => startEdit(duplicate)}>Edit existing</button>
          <button className="btn btn-primary" type="button" disabled={pending} onClick={persistNew}>Add anyway</button>
          <button className="btn" type="button" onClick={() => setDuplicate(null)}>Cancel</button>
        </div>
      </div>}
    </section>

    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}

    <section className="space-y-4" aria-labelledby="shopping-to-get">
      <h2 id="shopping-to-get" className="section-title">To get <span className="muted text-base font-normal">({active.length})</span></h2>
      {active.length === 0 && <div className="panel muted">Nothing on the list yet. Add whatever comes to mind.</div>}
      <div className="space-y-3">{active.map(item => <ShoppingRow key={item.id} item={item} isEditing={editingId === item.id} editFields={editFields} setEditFields={setEditFields} onEdit={() => startEdit(item)} onCancel={() => setEditingId(null)} onSave={event => saveEdit(event, item)} onToggle={() => toggle(item)} onRemove={() => remove(item)} pending={pending} />)}</div>
    </section>

    {checked.length > 0 && <section className="space-y-4" aria-labelledby="shopping-checked">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="shopping-checked" className="section-title">Checked <span className="muted text-base font-normal">({checked.length})</span></h2><button type="button" className="btn btn-danger" disabled={pending} onClick={clearChecked}>Clear checked</button></div>
      <div className="space-y-3">{checked.map(item => <ShoppingRow key={item.id} item={item} isEditing={editingId === item.id} editFields={editFields} setEditFields={setEditFields} onEdit={() => startEdit(item)} onCancel={() => setEditingId(null)} onSave={event => saveEdit(event, item)} onToggle={() => toggle(item)} onRemove={() => remove(item)} pending={pending} />)}</div>
    </section>}
  </div>;
}

type RowProps = {
  item: ShoppingItem;
  isEditing: boolean;
  editFields: ShoppingInput;
  setEditFields: React.Dispatch<React.SetStateAction<ShoppingInput>>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggle: () => void;
  onRemove: () => void;
  pending: boolean;
};

function ShoppingRow({ item, isEditing, editFields, setEditFields, onEdit, onCancel, onSave, onToggle, onRemove, pending }: RowProps) {
  return <article className="panel flex flex-wrap items-start gap-4 !p-4">
    <label className="flex shrink-0 items-center gap-2 pt-1 text-sm">
      <input type="checkbox" checked={item.isChecked} disabled={pending} onChange={onToggle} aria-label={`Mark ${item.displayName} ${item.isChecked ? 'not bought' : 'bought'}`} />
    </label>
    <div className="min-w-0 flex-1">
      {isEditing ? <form onSubmit={onSave} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(6rem,1fr)]">
          <div><label className="field-label" htmlFor={`name-${item.id}`}>Item name</label><input id={`name-${item.id}`} required maxLength={240} disabled={pending} value={editFields.displayName} onChange={e => setEditFields(current => ({ ...current, displayName: e.target.value }))} /></div>
          <div><label className="field-label" htmlFor={`quantity-${item.id}`}>Amount</label><input id={`quantity-${item.id}`} type="number" min="0" step="any" disabled={pending} value={editFields.quantity} onChange={e => setEditFields(current => ({ ...current, quantity: e.target.value }))} /></div>
          <div><label className="field-label" htmlFor={`unit-${item.id}`}>Unit</label><input id={`unit-${item.id}`} maxLength={80} disabled={pending} value={editFields.unit} onChange={e => setEditFields(current => ({ ...current, unit: e.target.value }))} /></div>
        </div>
        <div><label className="field-label" htmlFor={`intention-${item.id}`}>For</label><select id={`intention-${item.id}`} className="rounded-[.65rem] border border-[#455452] bg-[#111a19] px-4 py-3" disabled={pending} value={editFields.intention} onChange={e => setEditFields(current => ({ ...current, intention: e.target.value as ShoppingInput['intention'] }))}>{Object.entries(intentions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="flex flex-wrap gap-3"><button className="btn btn-primary" disabled={pending} type="submit">Save</button><button className="btn" disabled={pending} type="button" onClick={onCancel}>Cancel</button></div>
      </form> : <>
        <p className={item.isChecked ? 'text-lg text-[#a8b8b0] line-through' : 'text-lg font-medium'}>{item.displayName}{quantityLabel(item) && <span className="muted ml-2 text-sm font-normal no-underline">{quantityLabel(item)}</span>}</p>
        <p className="muted mt-1 text-xs">{intentions[item.intention]}{item.sourceType === 'plan' ? ' · From a plan' : ''}</p>
      </>}
    </div>
    {!isEditing && <div className="flex shrink-0 flex-wrap gap-2"><button className="btn" type="button" disabled={pending} onClick={onEdit}>Edit</button><button className="btn btn-danger" type="button" disabled={pending} onClick={onRemove}>Remove</button></div>}
  </article>;
}

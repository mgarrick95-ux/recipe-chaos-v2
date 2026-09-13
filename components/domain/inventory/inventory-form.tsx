'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  checkInventoryDuplicateAction,
  deleteInventoryAction,
  saveInventoryAction,
} from "@/app/pantry/actions";
import { inventoryToInput } from "@/domain/inventory/manual-entry";
import type { InventoryItem, ManualInventoryInput } from "@/domain/inventory/types";
import type { ServiceError } from "@/services/result";
import { inventoryErrorMessage } from "./messages";

const locationLabels = {
  pantry: "Pantry",
  fridge: "Fridge",
  freezer: "Freezer",
  leftovers: "Leftovers",
} as const;

export function InventoryForm({ item }: { item?: InventoryItem }) {
  const router = useRouter();
  const [fields, setFields] = useState<ManualInventoryInput>(() => inventoryToInput(item));
  const [error, setError] = useState<ServiceError | null>(null);
  const [duplicate, setDuplicate] = useState<InventoryItem | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ManualInventoryInput>(key: K, value: ManualInventoryInput[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    if (key === "displayName" || key === "location") setDuplicate(null);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      if (!item) {
        const duplicateResult = await checkInventoryDuplicateAction(fields);
        if (!duplicateResult.ok) {
          setError(duplicateResult.error);
          return;
        }
        if (duplicateResult.data) {
          setDuplicate(duplicateResult.data);
          return;
        }
      }

      await persist();
    });
  }

  async function persist() {
    const result = await saveInventoryAction(
      fields,
      item ? { itemId: item.id, expectedUpdatedAt: item.updatedAt } : undefined,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/pantry");
    router.refresh();
  }

  function addAnyway() {
    setError(null);
    startTransition(async () => {
      await persist();
    });
  }

  function cancelDuplicate() {
    setDuplicate(null);
  }

  function remove() {
    if (!item || !window.confirm(`Remove ${item.displayName} from FrostPantry?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteInventoryAction(item.id, item.updatedAt, true);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/pantry");
      router.refresh();
    });
  }

  return <form className="space-y-6" onSubmit={save}>
    <fieldset disabled={pending} className="space-y-6">
      <section className="panel space-y-5">
        <div>
          <label htmlFor="displayName" className="field-label">Food name <span className="muted">(required)</span></label>
          <input id="displayName" value={fields.displayName} required onChange={(e) => set("displayName", e.target.value)} placeholder="Chicken thighs, milk, rice…" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="quantity" className="field-label">Quantity</label>
            <input id="quantity" type="number" min="0" step="any" value={fields.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="2" />
          </div>
          <div>
            <label htmlFor="unit" className="field-label">Unit</label>
            <input id="unit" value={fields.unit} onChange={(e) => set("unit", e.target.value)} placeholder="kg, cans, bag…" />
          </div>
        </div>
        <div>
          <label htmlFor="location" className="field-label">Where is it?</label>
          <select id="location" className="w-full rounded-[.65rem] border border-[#455452] bg-[#111a19] px-4 py-3" value={fields.location} onChange={(e) => set("location", e.target.value as ManualInventoryInput["location"])}>
            <option value="pantry">Pantry</option>
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
            <option value="leftovers">Leftovers</option>
          </select>
        </div>
      </section>

      <section className="panel space-y-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <div><label htmlFor="purchaseDate" className="field-label">Bought</label><input id="purchaseDate" type="date" value={fields.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></div>
          <div><label htmlFor="storageDate" className="field-label">Stored</label><input id="storageDate" type="date" value={fields.storageDate} onChange={(e) => set("storageDate", e.target.value)} /></div>
          <div><label htmlFor="expiryDate" className="field-label">Best before / expiry</label><input id="expiryDate" type="date" value={fields.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={fields.useSoonStatus === "use_soon"} onChange={(e) => set("useSoonStatus", e.target.checked ? "use_soon" : "normal")} />Use soon</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={fields.isStaple} onChange={(e) => set("isStaple", e.target.checked)} />Staple</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={fields.isOutOfStock} onChange={(e) => set("isOutOfStock", e.target.checked)} />Out of stock</label>
        </div>
        <div><label htmlFor="notes" className="field-label">Notes</label><textarea id="notes" rows={3} value={fields.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering." /></div>
      </section>
    </fieldset>

    {duplicate && !item && <section className="rounded-[1rem] border border-purple-300/30 bg-purple-300/[.07] p-5" role="status">
      <p className="font-medium text-purple-100">Looks like this may already be in FrostPantry.</p>
      <p className="muted mt-2 text-sm">
        {duplicate.displayName} is already in {locationLabels[duplicate.location]}
        {duplicate.quantity !== null ? ` (${duplicate.quantity}${duplicate.unit ? ` ${duplicate.unit}` : ""})` : ""}.
        Nothing will be merged unless you choose to change it.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/pantry/${duplicate.id}/edit`} className="btn btn-primary">Edit existing</Link>
        <button type="button" className="btn" disabled={pending} onClick={addAnyway}>{pending ? "Adding…" : "Add anyway"}</button>
        <button type="button" className="btn" disabled={pending} onClick={cancelDuplicate}>Cancel</button>
      </div>
    </section>}

    {error && <div role="alert" className="error-message">{inventoryErrorMessage(error)}</div>}

    <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : item ? "Save changes" : "Add to FrostPantry"}</button>
      <Link href="/pantry" className="text-link text-sm">Cancel</Link>
      {item && <button className="btn btn-danger sm:ml-auto" type="button" disabled={pending} onClick={remove}>Remove item</button>}
    </div>
  </form>;
}

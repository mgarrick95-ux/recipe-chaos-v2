'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterInventory,
  isExpired,
  isSoonish,
  sortInventory,
  type InventoryFilter,
  type InventorySort,
} from "@/domain/inventory/filters";
import type { InventoryItem, InventoryLocation } from "@/domain/inventory/types";

const locations: InventoryLocation[] = ["pantry", "fridge", "freezer", "leftovers"];

const locationLabels: Record<InventoryLocation, string> = {
  pantry: "Pantry",
  fridge: "Fridge",
  freezer: "Freezer",
  leftovers: "Leftovers",
};

const filterOptions: Array<{ value: InventoryFilter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
  { value: "leftovers", label: "Leftovers" },
  { value: "soon", label: "Soon-ish" },
  { value: "expired", label: "Expired" },
];

const sortOptions: Array<{ value: InventorySort; label: string }> = [
  { value: "default", label: "Storage order" },
  { value: "name", label: "A–Z" },
  { value: "expiry", label: "Expiry soonest" },
];

export function InventoryBrowser({ items }: { items: InventoryItem[] }) {
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [sort, setSort] = useState<InventorySort>("default");
  const todayIso = localTodayIso();
  const visibleItems = useMemo(
    () => sortInventory(filterInventory(items, filter, todayIso), sort),
    [filter, items, sort, todayIso],
  );

  return <div className="space-y-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2" aria-label="Filter FrostPantry">
        {filterOptions.map((option) => {
          const active = filter === option.value;
          return <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={active
              ? "rounded-full border border-teal-300/50 bg-teal-300/15 px-4 py-2 text-sm font-medium text-teal-100"
              : "rounded-full border border-white/10 bg-white/[.03] px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:text-white"}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>;
        })}
      </div>

      <label className="flex items-center gap-3 text-sm text-zinc-300">
        <span className="whitespace-nowrap">Sort</span>
        <select
          aria-label="Sort FrostPantry"
          className="rounded-[.65rem] border border-white/10 bg-[#111a19] px-3 py-2 text-sm text-white"
          value={sort}
          onChange={(event) => setSort(event.target.value as InventorySort)}
        >
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>

    {visibleItems.length ? <InventorySections items={visibleItems} filter={filter} todayIso={todayIso} /> : <section className="panel flex min-h-52 flex-col items-center justify-center gap-4 text-center">
      <h2 className="section-title">Nothing here right now.</h2>
      <p className="muted max-w-md">That filter came up empty. No cleanup assignment attached.</p>
      <button type="button" className="text-link" onClick={() => setFilter("all")}>Show everything</button>
    </section>}
  </div>;
}

function InventorySections({ items, filter, todayIso }: { items: InventoryItem[]; filter: InventoryFilter; todayIso: string }) {
  if (filter === "soon" || filter === "expired") {
    const label = filter === "soon" ? "Soon-ish" : "Expired";
    return <section className="space-y-4">
      <SectionHeading label={label} count={items.length} />
      <InventoryGrid items={items} todayIso={todayIso} />
    </section>;
  }

  const sections = filter === "all" ? locations : [filter];
  return <div className="grid gap-8">
    {sections.map((location) => {
      const group = items.filter((item) => item.location === location);
      if (!group.length) return null;
      return <section key={location} className="space-y-4">
        <SectionHeading label={locationLabels[location]} count={group.length} />
        <InventoryGrid items={group} todayIso={todayIso} />
      </section>;
    })}
  </div>;
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center justify-between gap-4">
    <h2 className="section-title">{label}</h2>
    <span className="muted text-sm">{count} {count === 1 ? "item" : "items"}</span>
  </div>;
}

function InventoryGrid({ items, todayIso }: { items: InventoryItem[]; todayIso: string }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => <Link
      key={item.id}
      href={`/pantry/${item.id}/edit`}
      className="panel group flex min-h-44 flex-col gap-3 transition-colors hover:border-teal-400/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="section-title group-hover:text-teal-200">{item.displayName}</h3>
        {item.useSoonStatus === "use_soon" && <span className="rounded-full bg-purple-300/10 px-2 py-1 text-xs text-purple-200">Use soon</span>}
      </div>
      <p className="muted text-sm">{item.quantity !== null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "Quantity not tracked"}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
        {item.isStaple && <span className="rounded-full bg-teal-300/10 px-2 py-1 text-teal-200">Staple</span>}
        {item.isOutOfStock && <span className="rounded-full bg-rose-300/10 px-2 py-1 text-rose-200">Out of stock</span>}
        <ExpiryLabel item={item} todayIso={todayIso} />
      </div>
    </Link>)}
  </div>;
}

function ExpiryLabel({ item, todayIso }: { item: InventoryItem; todayIso: string }) {
  if (!item.expiryDate) return null;
  const date = formatDate(item.expiryDate);

  if (isExpired(item, todayIso)) {
    return <span className="rounded-full bg-rose-300/10 px-2 py-1 text-rose-200">Expired {date}</span>;
  }
  if (isSoonish(item, todayIso)) {
    return <span className="rounded-full bg-purple-300/10 px-2 py-1 text-purple-200">Use by {date}</span>;
  }
  return <span className="muted">Best by {date}</span>;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[Number(month) - 1] ?? month;
  const currentYear = String(new Date().getFullYear());
  return year === currentYear ? `${monthName} ${Number(day)}` : `${monthName} ${Number(day)}, ${year}`;
}

function localTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

import Link from "next/link";
import { listInventory } from "@/services/inventory";
import { InventoryLoadError } from "@/components/domain/inventory/load-error";

const locationLabels = {
  pantry: "Pantry",
  fridge: "Fridge",
  freezer: "Freezer",
  leftovers: "Leftovers",
} as const;

export default async function PantryPage() {
  const result = await listInventory();
  if (!result.ok) return <InventoryLoadError error={result.error} />;
  const items = result.data;

  return <div className="space-y-10">
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="eyebrow mb-4">What we already have</p>
        <h1 className="page-title">FrostPantry<span className="text-teal-300">.</span></h1>
        <p className="muted mt-4 max-w-xl">Pantry, fridge, freezer, and leftovers in one place. Close enough is useful — this does not need to become another chore.</p>
      </div>
      <Link href="/pantry/new" className="btn btn-primary">+ Add food</Link>
    </div>

    {items.length ? <div className="grid gap-8">
      {(["pantry", "fridge", "freezer", "leftovers"] as const).map((location) => {
        const group = items.filter((item) => item.location === location);
        if (!group.length) return null;
        return <section key={location} className="space-y-4">
          <div className="flex items-center justify-between gap-4"><h2 className="section-title">{locationLabels[location]}</h2><span className="muted text-sm">{group.length} {group.length === 1 ? "item" : "items"}</span></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.map((item) => <Link key={item.id} href={`/pantry/${item.id}/edit`} className="panel group flex min-h-44 flex-col gap-3 transition-colors hover:border-teal-400/60">
              <div className="flex items-start justify-between gap-3"><h3 className="section-title group-hover:text-teal-200">{item.displayName}</h3>{item.useSoonStatus === "use_soon" && <span className="rounded-full bg-purple-300/10 px-2 py-1 text-xs text-purple-200">Use soon</span>}</div>
              <p className="muted text-sm">{item.quantity !== null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "Quantity not tracked"}</p>
              <div className="mt-auto flex flex-wrap gap-2 text-xs">
                {item.isStaple && <span className="rounded-full bg-teal-300/10 px-2 py-1 text-teal-200">Staple</span>}
                {item.isOutOfStock && <span className="rounded-full bg-rose-300/10 px-2 py-1 text-rose-200">Out of stock</span>}
                {item.expiryDate && <span className="muted">Expiry {item.expiryDate}</span>}
              </div>
            </Link>)}
          </div>
        </section>;
      })}
    </div> : <section className="panel flex min-h-80 flex-col items-center justify-center gap-5 text-center">
      <span aria-hidden="true" className="text-5xl text-purple-300">❄</span>
      <h2 className="section-title">Your kitchen can be messy. Start anywhere.</h2>
      <p className="muted max-w-md leading-7">Add a few things you know you have. Recipe Chaos can become more useful as FrostPantry fills in over time.</p>
      <Link href="/pantry/new" className="text-link">Add your first item →</Link>
    </section>}
  </div>;
}

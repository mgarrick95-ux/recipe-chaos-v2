import Link from "next/link";
import { InventoryBrowser } from "@/components/domain/inventory/inventory-browser";
import { InventoryLoadError } from "@/components/domain/inventory/load-error";
import { listInventory } from "@/services/inventory";

export default async function PantryPage() {
  const result = await listInventory();
  if (!result.ok) return <InventoryLoadError error={result.error} />;
  const items = result.data;

  return <div className="enchanted-page enchanted-pantry space-y-8 sm:space-y-10">
    <header className="enchanted-hero">
      <div className="enchanted-hero-copy">
        <p className="eyebrow mb-4">What we already have</p>
        <h1 className="page-title">FrostPantry<span aria-hidden="true" className="enchanted-title-mark">✦</span></h1>
        <p className="muted mt-4 max-w-xl">Pantry, fridge, freezer, and leftovers in one place. Close enough is useful — this does not need to become another chore.</p>
      </div>
      <Link href="/pantry/new" className="btn btn-primary">+ Add food</Link>
    </header>

    {items.length ? <InventoryBrowser items={items} /> : <section className="panel enchanted-empty flex min-h-80 flex-col items-center justify-center gap-5 text-center">
      <span aria-hidden="true" className="text-5xl text-purple-300">❄</span>
      <h2 className="section-title">Your kitchen can be messy. Start anywhere.</h2>
      <p className="muted max-w-md leading-7">Add a few things you know you have. Recipe Chaos can become more useful as FrostPantry fills in over time.</p>
      <Link href="/pantry/new" className="text-link">Add your first item →</Link>
    </section>}
  </div>;
}

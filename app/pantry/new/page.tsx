import Link from "next/link";
import { InventoryForm } from "@/components/domain/inventory/inventory-form";

export default function NewPantryItemPage() {
  return <div className="mx-auto max-w-3xl">
    <Link href="/pantry" className="text-link text-sm">← FrostPantry</Link>
    <div className="mb-8 mt-7">
      <p className="eyebrow mb-3">One less thing to remember</p>
      <h1 className="page-title">Add food</h1>
      <p className="muted mt-4">A name is enough. Add details only when they are useful.</p>
    </div>
    <InventoryForm />
  </div>;
}

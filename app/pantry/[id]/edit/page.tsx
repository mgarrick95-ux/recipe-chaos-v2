import Link from "next/link";
import { getInventoryItem } from "@/services/inventory";
import { InventoryForm } from "@/components/domain/inventory/inventory-form";
import { InventoryLoadError } from "@/components/domain/inventory/load-error";

export default async function EditPantryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getInventoryItem(id);
  if (!result.ok) return <InventoryLoadError error={result.error} />;
  return <div className="mx-auto max-w-3xl">
    <Link href="/pantry" className="text-link text-sm">← FrostPantry</Link>
    <div className="mb-8 mt-7">
      <p className="eyebrow mb-3">Keep it roughly true</p>
      <h1 className="page-title">Edit {result.data.displayName}</h1>
      <p className="muted mt-4">Update what matters. FrostPantry does not need perfect inventory accounting.</p>
    </div>
    <InventoryForm item={result.data} />
  </div>;
}

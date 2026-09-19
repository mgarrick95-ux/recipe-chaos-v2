import { ShoppingList } from '@/components/domain/shopping/shopping-list';
import { listShoppingItems } from '@/services/shopping';

export default async function ShoppingPage() {
  const result = await listShoppingItems();
  if (!result.ok) return <div className="panel space-y-4" role="alert">
    <h1 className="section-title">Shopping list unavailable</h1>
    <p className="muted">{result.error.message}</p>
    {result.error.code === 'unauthorized'
      ? <a className="text-link" href="/sign-in">Sign in →</a>
      : <a className="text-link" href="/shopping">Try again →</a>}
  </div>;

  return <div className="space-y-9">
    <div>
      <p className="eyebrow mb-4">For the next shop</p>
      <h1 className="page-title">Shopping<span className="text-teal-300">.</span></h1>
      <p className="muted mt-4 max-w-xl">One list for what you need. Add something whenever it comes to mind; checking it off is enough.</p>
    </div>
    <ShoppingList initialItems={result.data} />
  </div>;
}

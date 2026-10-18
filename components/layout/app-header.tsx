import Link from 'next/link';

export function AppHeader() {
  return <header className="app-header border-b border-white/10">
    <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <Link href="/" className="flex items-center gap-3">
        <span aria-hidden="true" className="brand-mark">↝</span>
        <span className="flex flex-col"><span className="brand-name">Recipe <span className="text-teal-300">Chaos</span><span className="text-purple-300">.</span></span><span className="maker-signature">Made by Grimm Kreations</span></span>
      </Link>
      <nav aria-label="Main" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
        <Link href="/recipes" className="nav-link">Recipes</Link>
        <Link href="/pantry" className="nav-link">FrostPantry</Link>
        <Link href="/shopping" className="nav-link">Shopping</Link>
        <Link href="/plan" className="nav-link">Weekly Plan</Link>
      </nav>
    </div>
  </header>;
}

import Link from 'next/link';

export function AppHeader() {
  return <header className="border-b border-white/10">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span aria-hidden="true" className="brand-mark">↝</span>
        <span>Recipe <span className="text-teal-300">Chaos</span><span className="text-purple-300">.</span></span>
      </Link>
      <nav aria-label="Main"><Link href="/recipes" className="nav-link">Recipes</Link></nav>
    </div>
  </header>;
}

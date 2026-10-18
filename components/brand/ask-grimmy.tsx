'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState } from 'react';

type GrimmyShortcut = { label: string; href: string; hint: string };

function pageHelp(path: string): { title: string; message: string; shortcuts: GrimmyShortcut[] } {
  if (path.startsWith('/plan')) return {
    title: 'Planning something?',
    message: 'I can help find dinner ideas, or take you straight to Meal Brain.',
    shortcuts: [
      { label: 'Suggest meals for this week', href: '#meal-brain-title', hint: 'Use Meal Brain' },
      { label: 'Find a different recipe', href: '/recipes/discover', hint: 'Browse new ideas' },
      { label: 'Check FrostPantry', href: '/pantry', hint: 'See what is on hand' },
    ],
  };
  if (path.startsWith('/pantry')) return {
    title: 'Let me peek in the cupboards!',
    message: 'Want help turning the food you have into dinner ideas?',
    shortcuts: [
      { label: 'What could I cook?', href: '/plan#meal-brain-title', hint: 'Meal Brain considers your pantry' },
      { label: 'Add food to FrostPantry', href: '/pantry/new', hint: 'Keep the shelves up to date' },
      { label: 'Find something new', href: '/recipes/discover', hint: 'Look for recipes' },
    ],
  };
  if (path.startsWith('/shopping')) return {
    title: 'Shopping expedition?',
    message: 'After you choose meals, I can help you check what is missing.',
    shortcuts: [
      { label: 'Review planned ingredients', href: '/plan', hint: 'Approve shopping additions yourself' },
      { label: 'Check FrostPantry', href: '/pantry', hint: 'See what you already have' },
      { label: 'Find a recipe', href: '/recipes/discover', hint: 'Get dinner inspiration' },
    ],
  };
  return {
    title: 'What are we cooking?',
    message: 'I can find recipes from the wider world and help bring them into your recipe box.',
    shortcuts: [
      { label: 'Grimmy, find me a recipe', href: '/recipes/discover', hint: 'Search a recipe catalogue' },
      { label: 'Bring in a recipe link', href: '/recipes/import', hint: 'Preview, edit, then save' },
      { label: 'Plan some meals', href: '/plan', hint: 'Try Meal Brain' },
    ],
  };
}

/** A page-aware helper with real shortcuts, not a pretend chatbot. */
export function AskGrimmy() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const labelId = useId();
  const panelId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const [query, setQuery] = useState('');
  const help = pageHelp(pathname);
  const hide = pathname.startsWith('/sign-in') || pathname.startsWith('/auth/');

  if (hide) return null;

  function findRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setOpenPath(null);
    router.push('/recipes/discover?q=' + encodeURIComponent(value));
  }

  return <aside className="grimmy-helper" aria-label="Ask Grimmy">
    {open && <section id={panelId} className="grimmy-helper-dialog" aria-labelledby={labelId}>
      <div className="grimmy-helper-top">
        <Image src="/brand/lil-grimmy.png" width={78} height={82} alt="" className="grimmy-helper-image" />
        <div>
          <p className="grimmy-helper-kicker">A little kitchen magic</p>
          <h2 id={labelId} className="grimmy-helper-title">{help.title}</h2>
        </div>
        <button type="button" onClick={() => setOpenPath(null)}
          className="grimmy-helper-close" aria-label="Close Ask Grimmy">×</button>
      </div>
      <p className="grimmy-helper-message">{help.message}</p>
      <form className="grimmy-helper-search" onSubmit={findRecipe}>
        <label htmlFor="grimmy-ask-search">What sounds good?</label>
        <div className="grimmy-helper-search-controls">
          <input id="grimmy-ask-search" type="search" value={query} minLength={2} maxLength={80}
            placeholder="Garlic chicken, soup…" onChange={event => setQuery(event.target.value)} required />
          <button type="submit">Find it</button>
        </div>
      </form>
      <nav className="grimmy-helper-links" aria-label="Grimmy's suggestions">
        {help.shortcuts.map(shortcut => <Link key={shortcut.label} href={shortcut.href}
          onClick={() => setOpenPath(null)}>
          <span>{shortcut.label}</span>
          <small>{shortcut.hint}</small>
        </Link>)}
      </nav>
      <p className="grimmy-helper-disclaimer">
        I have useful shortcuts, not unlimited AI chat (yet). I&apos;ll always ask before saving a recipe or meal.
      </p>
    </section>}
    <button type="button" className="grimmy-helper-trigger" aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpenPath(current => current === pathname ? null : pathname)}>
      <Image src="/brand/lil-grimmy.png" width={44} height={46} alt="" />
      <span>{open ? 'Close Grimmy' : 'Ask Grimmy'}</span>
    </button>
  </aside>;
}

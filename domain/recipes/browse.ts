// Read-only browsing. Never changes a recipe or its authored text.
export type RecipeSort = 'keepers' | 'newest' | 'oldest' | 'az' | 'za';

export type BrowseRecipe = {
  id: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  updatedAt: string;
  searchText?: string;
};

export type RecipeBrowseOptions = {
  query: string;
  favoritesOnly: boolean;
  sort: RecipeSort;
};

const titles = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function simplify(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

function tieBreak(a: BrowseRecipe, b: BrowseRecipe): number {
  return titles.compare(a.title, b.title) || a.id.localeCompare(b.id);
}

function dateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function browseRecipes<T extends BrowseRecipe>(recipes: readonly T[], options: RecipeBrowseOptions): T[] {
  const words = simplify(options.query).split(' ').filter(Boolean);
  return recipes.filter(recipe => {
    if (options.favoritesOnly && !recipe.isFavorite) return false;
    if (words.length === 0) return true;
    const content = simplify([recipe.title, recipe.description ?? '', recipe.searchText ?? ''].join(' '));
    return words.every(word => content.includes(word));
  }).sort((a, b) => {
    if (options.sort === 'az') return tieBreak(a, b);
    if (options.sort === 'za') return -tieBreak(a, b);
    if (options.sort === 'keepers' && a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const recent = dateValue(b.updatedAt) - dateValue(a.updatedAt);
    return (options.sort === 'oldest' ? -recent : recent) || tieBreak(a, b);
  });
}

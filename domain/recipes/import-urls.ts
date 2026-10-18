/** Restrict URL previews to known recipe publishers: no arbitrary internal fetches. */
const supportedPublishers = [
  'allrecipes.com', 'budgetbytes.com', 'recipetineats.com', 'simplyrecipes.com',
  'foodnetwork.com', 'bbcgoodfood.com', 'seriouseats.com', 'loveandlemons.com',
  'skinnytaste.com', 'thekitchn.com', 'spendwithpennies.com', 'minimalistbaker.com',
  'cookieandkate.com', 'themediterraneandish.com', 'damndelicious.net',
  'tastesbetterfromscratch.com', 'onceuponachef.com', 'wellplated.com',
  'sallysbakingaddiction.com', 'kingarthurbaking.com', 'delish.com',
  'tasteofhome.com', 'eatingwell.com', 'downshiftology.com',
  'ambitiouskitchen.com', 'gimmesomeoven.com', 'thepioneerwoman.com',
  'bonappetit.com', 'bakingmischief.com',
] as const;

export function validateRecipeImportUrl(input: string):
  { ok: true; url: string } | { ok: false; message: string } {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim())
    return { ok: false, message: 'Paste a recipe page link to preview it.' };
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.searchParams.toString().length > 1200) {
      return { ok: false, message: 'Use a direct HTTPS recipe page link without credentials or a custom port.' };
    }
    const host = url.hostname.toLowerCase();
    if (!supportedPublishers.some(domain => host === domain || host.endsWith('.' + domain))) {
      return {
        ok: false,
        message: 'Automatic previews currently work with selected recipe publishers. Try a site like Allrecipes, Budget Bytes, RecipeTin Eats or BBC Good Food.',
      };
    }
    url.hash = '';
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: 'That does not look like a valid recipe page URL.' };
  }
}

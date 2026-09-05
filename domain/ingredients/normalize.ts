export function normalizeIngredientName(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/^[\s"'.,;:!?()[\]{}]+|[\s"'.,;:!?()[\]{}]+$/g, "")
    .replace(/\s+/g, " ");
}

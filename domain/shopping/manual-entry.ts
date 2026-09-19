import type { ShoppingDraft, ShoppingInput, ShoppingItem } from './types.ts';

export function shoppingToInput(item?: ShoppingItem): ShoppingInput {
  return {
    displayName: item?.displayName ?? '',
    quantity: item?.quantity?.toString() ?? '',
    unit: item?.unit ?? '',
    intention: item?.intention ?? 'general',
  };
}

export function buildManualShopping(input: ShoppingInput): ShoppingDraft {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 240) throw new Error('A shopping item name is required.');
  if (!['general', 'this_week', 'staple'].includes(input.intention)) throw new Error('Choose a valid intention.');

  let quantity: number | null = null;
  if (input.quantity.trim() !== '') {
    quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be zero or greater.');
  }

  const unit = input.unit.trim();
  if (unit.length > 80) throw new Error('Unit is too long.');
  return { displayName, quantity, unit: unit || null, intention: input.intention };
}

// Positions need not be contiguous in storage, but must be unique and nonnegative.
export function validateOrdering(rows: readonly { id?: string; position: number }[]): void {
  const ids = new Set<string>();
  const positions = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.position) || row.position < 0 || row.position > 2147483647) {
      throw new Error('Position must be a nonnegative PostgreSQL integer.');
    }
    if (positions.has(row.position)) throw new Error('Duplicate position.');
    positions.add(row.position);
    if (row.id !== undefined) {
      if (!row.id || ids.has(row.id)) throw new Error('Missing or duplicate row ID.');
      ids.add(row.id);
    }
  }
}

// Caller supplies rows in the desired order. Preserve IDs and all authored fields.
export function assignPositions<T extends { id?: string; position: number }>(rows: readonly T[]): T[] {
  const ordered = rows.map((row, position) => ({ ...row, position }));
  validateOrdering(ordered);
  return ordered;
}

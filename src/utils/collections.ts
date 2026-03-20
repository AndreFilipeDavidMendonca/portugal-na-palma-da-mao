export function uniqStrings(arr: Array<string | null | undefined>): string[] {
  return Array.from(new Set((arr ?? []).filter((value): value is string => Boolean(value))));
}

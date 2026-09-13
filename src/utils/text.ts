// Minuscules sans accents, espaces normalisés — pour comparer et filtrer
export function normalize(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Première lettre de chaque mot en majuscule, en conservant l'espace final en cours de frappe
export function capitalize(value: string | null | undefined, preserveTrailingSpace = false): string {
  const input = String(value || '')
  const trailingSpace = preserveTrailingSpace ? input.match(/\s*$/)?.[0] || '' : ''
  return input
    .trimStart()
    .toLowerCase()
    .replace(/(^|\s|[-'’])(\p{L})/gu, (_, separator: string, char: string) => `${separator}${char.toUpperCase()}`)
    + trailingSpace
}

// Vrai si l'une des valeurs contient la recherche
export function matches(query: string, values: (string | number | null | undefined)[]): boolean {
  const q = normalize(query)
  return !q || values.some((value) => normalize(value).includes(q))
}

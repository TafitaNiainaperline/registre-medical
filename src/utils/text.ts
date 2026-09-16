// Minuscules sans accents, espaces normalisés — pour comparer et filtrer
export function normalize(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Première lettre en majuscule, en conservant le reste du texte saisi.
export function capitalize(value: string | null | undefined, preserveTrailingSpace = false): string {
  const input = String(value || '')
  const text = preserveTrailingSpace ? input.trimStart() : input.trim()
  return text.replace(/\p{L}/u, (char) => char.toUpperCase())
}

// Vrai si l'une des valeurs contient la recherche
export function matches(query: string, values: (string | number | null | undefined)[]): boolean {
  const q = normalize(query)
  return !q || values.some((value) => normalize(value).includes(q))
}

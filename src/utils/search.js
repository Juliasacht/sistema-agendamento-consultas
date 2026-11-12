export function normalizeSearch(value) {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}
export function containsLike(value) {
  return '%' + value.replace(/[!%_]/g, character => '!' + character) + '%';
}

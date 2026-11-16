export function workKeywords(listRole: unknown, slug?: string): string[] {
  const values = typeof listRole === 'string' && listRole.trim() ? listRole.split('·') : slug === 'printsafe' ? ['PDF', '일괄 인쇄'] : [];
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(0, 4);
}

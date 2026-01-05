export type CanonicalCondition = 'Sıfır' | '2. El' | 'Az Kullanılmış';

function normalizeRaw(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[._\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toCanonicalCondition(raw?: string | null): CanonicalCondition | '' {
  const value = (raw ?? '').trim();
  if (!value) return '';

  const normalized = normalizeRaw(value);

  // Legacy DB values
  if (normalized === 'new') return 'Sıfır';
  if (normalized === 'used') return '2. El';

  // Canonical / common user-facing variants
  if (
    normalized === 'sıfır' ||
    normalized === 'sifir' ||
    normalized.includes('sıfır') ||
    normalized.includes('sifir') ||
    normalized === 'yeni'
  ) {
    return 'Sıfır';
  }

  if (
    normalized === '2 el' ||
    normalized === '2el' ||
    normalized.includes('2 el') ||
    normalized.includes('2el') ||
    normalized.includes('ikinci el') ||
    normalized.includes('kullanılmış') ||
    normalized.includes('kullanilmis')
  ) {
    return '2. El';
  }

  if (normalized.includes('az kullan')) return 'Az Kullanılmış';

  // Older UI labels that imply used
  if (normalized.includes('iyi') || normalized.includes('orta') || normalized.includes('temiz') || normalized.includes('normal')) {
    return '2. El';
  }

  // Keep the value if it looks like a TR label, otherwise fall back to used.
  // (This prevents showing English 'new/used' while avoiding surprise blanks.)
  if (normalized.length > 0) {
    return '2. El';
  }

  return '';
}

export function conditionBadgeClass(raw?: string | null): string {
  const c = toCanonicalCondition(raw);
  if (c === 'Sıfır') return 'bg-green-100 text-green-700';
  if (c === '2. El') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
}

export function expandConditionFilter(selected: string[]): string[] {
  const expanded = new Set<string>();

  for (const item of selected || []) {
    const canonical = toCanonicalCondition(item);

    if (canonical === 'Sıfır') {
      expanded.add('Sıfır');
      expanded.add('new');
      expanded.add('sifir');
      expanded.add('sıfır');
      expanded.add('Yeni');
      continue;
    }

    if (canonical === '2. El') {
      expanded.add('2. El');
      expanded.add('2.el');
      expanded.add('2el');
      expanded.add('Kullanılmış');
      expanded.add('Kullanilmis');
      expanded.add('used');
      expanded.add('İkinci El');
      continue;
    }

    if (canonical === 'Az Kullanılmış') {
      expanded.add('Az Kullanılmış');
      expanded.add('Az kullanılmış');
      expanded.add('az-kullanilmis');
      continue;
    }

    if (item) expanded.add(item);
  }

  return Array.from(expanded);
}

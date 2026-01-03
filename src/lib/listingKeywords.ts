export type ListingKeywords = {
  keywords: string[];
  keywords_text: string;
};

function tokenize(text: string): string[] {
  const t = (text || '').toLowerCase();
  // Turkish letters + numbers + plus (room formats like 2+1)
  const matches = t.match(/[0-9a-zçğıöşü+]{2,}/gi);
  if (!matches) return [];
  return matches
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => (m.endsWith('+') ? m.slice(0, -1) : m));
}

function inferSynonyms(input: { category: string; title: string; description?: string }): string[] {
  const category = (input.category || '').toLowerCase();
  const title = (input.title || '').toLowerCase();
  const desc = (input.description || '').toLowerCase();
  const haystack = `${category} ${title} ${desc}`;

  const add = new Set<string>();

  // Category-level recall helpers (broad queries like "araba ilanları")
  if (category.includes('otomotiv') || category.includes('vasıta') || category.includes('vasita') || category.includes('araç') || category.includes('arac')) {
    for (const w of ['araba', 'otomobil', 'araç', 'otomotiv']) add.add(w);
  }

  if (category.includes('emlak') || category.includes('konut') || category.includes('gayrimenkul')) {
    for (const w of ['emlak', 'ev', 'daire', 'konut']) add.add(w);
  }

  if (category.includes('ev & yaşam') || category.includes('ev & yasam') || category.includes('ev ve yaşam') || category.includes('ev ve yasam')) {
    for (const w of ['ev', 'yaşam', 'yasam', 'ev eşyası', 'ev esyasi', 'mobilya', 'dekorasyon']) add.add(w);
  }

  if (category.includes('moda') || category.includes('giyim') || category.includes('aksesuar')) {
    for (const w of ['moda', 'giyim', 'kıyafet', 'kiyafet', 'ayakkabı', 'ayakkabi', 'çanta', 'canta', 'aksesuar']) add.add(w);
  }

  if (category.includes('anne') || category.includes('bebek') || category.includes('oyuncak') || category.includes('çocuk') || category.includes('cocuk')) {
    for (const w of ['anne', 'bebek', 'çocuk', 'cocuk', 'oyuncak']) add.add(w);
  }

  if (category.includes('spor') || category.includes('outdoor') || category.includes('kamp')) {
    for (const w of ['spor', 'outdoor', 'kamp', 'fitness']) add.add(w);
  }

  if (category.includes('hobi') || category.includes('koleksiyon') || category.includes('sanat')) {
    for (const w of ['hobi', 'koleksiyon', 'sanat']) add.add(w);
  }

  if (category.includes('iş makineleri') || category.includes('is makineleri') || category.includes('sanayi') || category.includes('endüstri') || category.includes('endustri')) {
    for (const w of ['sanayi', 'endüstri', 'endustri', 'makine', 'ekipman']) add.add(w);
  }

  if (category.includes('yedek parça') || category.includes('yedek parca')) {
    for (const w of ['yedek', 'parça', 'parca', 'aksesuar']) add.add(w);
  }

  if (category.includes('hizmet') || category.includes('ustalar') || category.includes('servis')) {
    for (const w of ['hizmet', 'usta', 'tamir', 'servis']) add.add(w);
  }

  if (category.includes('eğitim') || category.includes('egitim') || category.includes('kurs') || category.includes('özel ders') || category.includes('ozel ders')) {
    for (const w of ['eğitim', 'egitim', 'kurs', 'ders', 'özel', 'ozel']) add.add(w);
  }

  if (category.includes('iş ilan') || category.includes('is ilan') || category.includes('kariyer')) {
    for (const w of ['iş', 'is', 'ilan', 'kariyer', 'eleman', 'personel']) add.add(w);
  }

  if (category.includes('dijital')) {
    for (const w of ['dijital', 'online', 'yazılım', 'yazilim', 'lisans', 'abonelik']) add.add(w);
  }

  if (category.includes('diğer') || category.includes('diger') || category.includes('genel')) {
    for (const w of ['genel', 'diğer', 'diger']) add.add(w);
  }

  if (category.includes('elektronik') || category.includes('telefon') || category.includes('bilgisayar')) {
    add.add('elektronik');
  }

  // Title/brand hints for phones
  if (haystack.includes('iphone') || haystack.includes('ipad') || haystack.includes('ios')) {
    for (const w of ['telefon', 'akıllı', 'akilli', 'smartphone', 'iphone']) add.add(w);
  }

  if (haystack.includes('samsung') || haystack.includes('galaxy') || haystack.includes('xiaomi') || haystack.includes('redmi') || haystack.includes('huawei')) {
    for (const w of ['telefon', 'akıllı', 'akilli', 'android']) add.add(w);
  }

  // Laptop/PC hints
  if (
    haystack.includes('laptop') ||
    haystack.includes('notebook') ||
    haystack.includes('macbook') ||
    haystack.includes('lenovo') ||
    haystack.includes('dell') ||
    haystack.includes('asus') ||
    haystack.includes('acer') ||
    haystack.includes('msi') ||
    haystack.includes('hp')
  ) {
    for (const w of ['bilgisayar', 'laptop', 'notebook']) add.add(w);
  }

  // Console/gaming hints
  if (haystack.includes('ps5') || haystack.includes('ps4') || haystack.includes('playstation') || haystack.includes('xbox') || haystack.includes('nintendo')) {
    for (const w of ['konsol', 'oyun', 'gaming']) add.add(w);
  }

  return Array.from(add);
}

export function generateListingKeywordsFallback(input: {
  title: string;
  category: string;
  description?: string;
  condition?: string;
  max?: number;
}): ListingKeywords {
  const { title, category, description = '', condition = '', max = 12 } = input;

  const stop = new Set([
    'satılık',
    'satilik',
    'kiralık',
    'kiralik',
    'urun',
    'ürün',
    'esya',
    'eşya',
    'temiz',
    'az',
    'kullanılmış',
    'kullanilmis',
    'iyi',
    'durumda',
    'fiyat',
    'tl',
    'acil',
    'hemen',
    'pazarlik',
    'pazarlık',
  ]);

  const raw: string[] = [];

  // Inject a few high-value synonyms early for better broad-query recall.
  for (const s of inferSynonyms({ category, title, description })) {
    raw.push(s);
  }

  for (const src of [title, category, description, condition]) {
    for (const w of tokenize(src)) {
      if (!w) continue;
      if (stop.has(w)) continue;
      raw.push(w);
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const w of raw) {
    if (seen.has(w)) continue;
    seen.add(w);
    deduped.push(w);
    if (deduped.length >= max) break;
  }

  return {
    keywords: deduped,
    keywords_text: deduped.join(' '),
  };
}

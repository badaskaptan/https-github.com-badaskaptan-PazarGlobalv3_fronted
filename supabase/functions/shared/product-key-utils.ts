// 🔑 PRODUCT KEY NORMALIZATION ALGORITHM
// Aynı ürün = aynı key mantığı

/**
 * Ürün başlığını normalize edilmiş product key'e çevirir
 * Örnek: "iPhone 14 Pro 256GB" → "iphone_14_pro_256gb"
 */
export function normalizeProductKey(title: string, category: string): string {
  // 1️⃣ Türkçe karakterleri değiştir
  const turkishMap: { [key: string]: string } = {
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'I': 'I',
    'İ': 'I', 'i': 'i',
    'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U'
  };

  let normalized = title;
  for (const [turkish, english] of Object.entries(turkishMap)) {
    normalized = normalized.replace(new RegExp(turkish, 'g'), english);
  }

  // 2️⃣ Küçük harfe çevir
  normalized = normalized.toLowerCase();

  // 3️⃣ Gereksiz kelimeleri kaldır
  const stopWords = [
    'satilik', 'temiz', 'bakimli', 'orjinal', 'orijinal',
    'az', 'kullanilmis', 'sifir', 'ayarinda', 'gibi',
    'hatasiz', 'boyasiz', 'degisensiz', 'garantili',
    'acil', 'ucuz', 'uygun', 'firsat', 'son', 'model',
    'yeni', 'ikinci', 'el', '2.el', 'ikinciel'
  ];

  stopWords.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });

  // 4️⃣ Özel karakterleri temizle
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ') // Sadece harf, rakam, boşluk
    .replace(/\s+/g, ' ')         // Çoklu boşlukları tek yap
    .trim();                      // Baştaki/sondaki boşlukları kaldır

  // 5️⃣ Kategori ekle (opsiyonel ama önemli)
  const categoryKey = category
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

  // 6️⃣ Kelimeleri alt çizgi ile birleştir
  const words = normalized.split(' ').filter(w => w.length > 0);
  const productKey = words.join('_');

  // 7️⃣ Final key: category_product
  return `${categoryKey}_${productKey}`;
}

/**
 * Benzerlik skoru hesapla (Jaccard similarity)
 * İki product key arasındaki benzerliği ölçer
 * Sonuç: 0.0 (tamamen farklı) - 1.0 (tamamen aynı)
 */
export function calculateSimilarity(key1: string, key2: string): number {
  const words1 = new Set(key1.split('_'));
  const words2 = new Set(key2.split('_'));

  // Kesişim (intersection)
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  
  // Birleşim (union)
  const union = new Set([...words1, ...words2]);

  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Güvenilirlik skoru hesapla
 * Faktörler:
 * - Kaynak sayısı (çok kaynak = yüksek güven)
 * - Veri güncelliği (taze = yüksek güven)
 * - Fiyat tutarlılığı (dar aralık = yüksek güven)
 */
interface PriceSource {
  name: string;
  url?: string;
  date?: string;
}

export function calculateConfidence(data: {
  sources: PriceSource[];
  lastUpdated: Date;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
}): number {
  let confidence = 0.0;

  // 1️⃣ Kaynak sayısı (max 0.4)
  const sourceScore = Math.min(data.sources.length / 10, 1.0) * 0.4;
  confidence += sourceScore;

  // 2️⃣ Güncellik (max 0.3)
  const daysSinceUpdate = (Date.now() - data.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  const freshnessScore = Math.max(0, 1 - (daysSinceUpdate / 7)) * 0.3;
  confidence += freshnessScore;

  // 3️⃣ Fiyat tutarlılığı (max 0.3)
  const priceRange = data.maxPrice - data.minPrice;
  const priceRangeRatio = priceRange / data.avgPrice;
  const consistencyScore = Math.max(0, 1 - priceRangeRatio) * 0.3;
  confidence += consistencyScore;

  return Math.min(Math.max(confidence, 0), 1.0);
}

/**
 * TTL hesapla
 */
export function calculateTTL(category: string): number {
  const ttlMap: { [key: string]: number } = {
    'Elektronik': 7,
    'Otomotiv': 14,
    'Emlak': 30,
    'Moda & Aksesuar': 7,
    'Ev & Yaşam': 14,
    'Spor & Outdoor': 14,
    'Kitap & Hobi': 30,
    'Mobilya': 21,
    'Diğer': 14
  };

  return ttlMap[category] || 14; // Varsayılan 14 gün
}

/**
 * Test fonksiyonu
 */
export function testNormalization() {
  const testCases = [
    'iPhone 14 Pro 256GB Sıfır Kutusunda',
    'iphone 14 pro 256 gb az kullanılmış',
    'IPHONE 14 PRO 256GB TERTEMİZ',
    '2015 Volkswagen Golf 1.6 TDI Temiz Bakımlı',
    'Nike Air Max 270 Erkek Ayakkabı Orijinal'
  ];

  console.log('🧪 Product Key Normalizasyon Testleri:\n');

  testCases.forEach(title => {
    const key = normalizeProductKey(title, 'Elektronik');
    console.log(`📦 "${title}"`);
    console.log(`🔑 "${key}"\n`);
  });

  // Benzerlik testi
  const key1 = normalizeProductKey('iPhone 14 Pro 256GB', 'Elektronik');
  const key2 = normalizeProductKey('iPhone 14 Pro 256 GB Sıfır', 'Elektronik');
  const key3 = normalizeProductKey('iPhone 15 Pro 256GB', 'Elektronik');

  console.log('🔍 Benzerlik Testleri:\n');
  console.log(`key1: ${key1}`);
  console.log(`key2: ${key2}`);
  console.log(`Similarity: ${calculateSimilarity(key1, key2).toFixed(2)} (aynı ürün)\n`);
  
  console.log(`key1: ${key1}`);
  console.log(`key3: ${key3}`);
  console.log(`Similarity: ${calculateSimilarity(key1, key3).toFixed(2)} (farklı ürün)\n`);
}

// Test çalıştır (sadece development)
if (import.meta.url === `file://${process.argv[1]}`) {
  testNormalization();
}

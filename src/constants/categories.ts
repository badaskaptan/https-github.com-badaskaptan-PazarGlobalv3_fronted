export type CategoryOption = { id: string; label: string };

export const FALLBACK_CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'Emlak', label: 'Emlak' },
  { id: 'Otomotiv', label: 'Otomotiv' },
  { id: 'Elektronik', label: 'Elektronik' },
  { id: 'Ev & Yaşam', label: 'Ev & Yaşam' },
  { id: 'Moda & Aksesuar', label: 'Moda & Aksesuar' },
  { id: 'Anne, Bebek & Oyuncak', label: 'Anne, Bebek & Oyuncak' },
  { id: 'Spor & Outdoor', label: 'Spor & Outdoor' },
  { id: 'Hobi, Koleksiyon & Sanat', label: 'Hobi, Koleksiyon & Sanat' },
  { id: 'İş Makineleri & Sanayi', label: 'İş Makineleri & Sanayi' },
  { id: 'Yedek Parça & Aksesuar', label: 'Yedek Parça & Aksesuar' },
  { id: 'Hizmetler', label: 'Ustalar & Hizmetler' },
  { id: 'Eğitim & Kurs', label: 'Özel Ders & Eğitim' },
  { id: 'İş İlanları', label: 'İş İlanları' },
  { id: 'Dijital Ürün & Hizmetler', label: 'Dijital Ürün & Hizmetler' },
  { id: 'Diğer', label: 'Genel / Diğer' },
];

const ICON_BY_CATEGORY_ID: Record<string, string> = {
  Elektronik: 'ri-smartphone-line',
  Otomotiv: 'ri-car-line',
  Emlak: 'ri-home-4-line',
  'Moda & Aksesuar': 'ri-shirt-line',
  'Spor & Outdoor': 'ri-basketball-line',
  'Anne, Bebek & Oyuncak': 'ri-bear-smile-line',
  'Hobi, Koleksiyon & Sanat': 'ri-palette-line',
  'İş Makineleri & Sanayi': 'ri-building-line',
  'Yedek Parça & Aksesuar': 'ri-hammer-line',
  'Eğitim & Kurs': 'ri-graduation-cap-line',
  'İş İlanları': 'ri-building-line',
  'Dijital Ürün & Hizmetler': 'ri-smartphone-line',
  Hizmetler: 'ri-service-line',
  Diğer: 'ri-more-line',
  'Ev & Yaşam': 'ri-home-4-line',
};

export const getCategoryIcon = (categoryId: string): string => {
  return ICON_BY_CATEGORY_ID[categoryId] || 'ri-more-line';
};

export const getCategoryDisplayLabel = (categoryId: string): string => {
  // Keep UI consistent even when we only have canonical ids from DB.
  const mapped = FALLBACK_CATEGORY_OPTIONS.find((o) => o.id === categoryId);
  return mapped?.label || categoryId;
};

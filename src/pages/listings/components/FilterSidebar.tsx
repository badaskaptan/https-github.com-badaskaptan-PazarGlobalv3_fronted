import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { FilterState } from '../../../types/listing';
import { fetchCategoryOptions } from '../../../services/agentApi';
import { FALLBACK_CATEGORY_OPTIONS, getCategoryIcon } from '../../../constants/categories';

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
}


const conditions = [
  { id: 'sifir', name: 'Sıfır' },
  { id: 'az-kullanilmis', name: 'Az Kullanılmış' },
  { id: 'kullanilmis', name: 'Kullanılmış' },
];

const dateRanges = [
  { id: 'all', name: 'Tüm Zamanlar' },
  { id: 'today', name: 'Bugün' },
  { id: 'week', name: 'Son 7 Gün' },
  { id: 'month', name: 'Son 30 Gün' },
];

export default function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const [categoryOptions, setCategoryOptions] = useState(FALLBACK_CATEGORY_OPTIONS);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchCategoryOptions();
        if (mounted && Array.isArray(opts) && opts.length > 0) {
          setCategoryOptions(opts);
        }
      } catch {
        // keep fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(
    () => categoryOptions.map((opt) => ({ id: opt.id, name: opt.label, icon: getCategoryIcon(opt.id) })),
    [categoryOptions]
  );

  const toggleCategory = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(c => c !== categoryId)
      : [...filters.categories, categoryId];
    onFilterChange({ categories: newCategories });
  };

  const toggleCondition = (conditionId: string) => {
    const newConditions = filters.condition.includes(conditionId)
      ? filters.condition.filter(c => c !== conditionId)
      : [...filters.condition, conditionId];
    onFilterChange({ condition: newConditions });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-28">
      <h3 className="text-lg font-bold mb-6">Filtreler</h3>

      {/* Kategoriler */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Kategoriler</h4>
        <div className="space-y-2">
          {categories.map(category => (
            <motion.button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                filters.categories.includes(category.id)
                  ? 'bg-gradient-primary text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <i className={`${category.icon} text-lg`} />
              <span className="text-sm font-medium">{category.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Fiyat Aralığı */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Fiyat Aralığı</h4>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              type="number"
              value={filters.priceRange[0]}
              onChange={(e) =>
                onFilterChange({ priceRange: [Number(e.target.value), filters.priceRange[1]] })
              }
              placeholder="Min"
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              value={filters.priceRange[1]}
              onChange={(e) =>
                onFilterChange({ priceRange: [filters.priceRange[0], Number(e.target.value)] })
              }
              placeholder="Max"
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {filters.priceRange[0].toLocaleString('tr-TR')} ₺ - {filters.priceRange[1].toLocaleString('tr-TR')} ₺
          </div>
        </div>
      </div>

      {/* Konum */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Konum</h4>
        <div className="relative">
          <i className="ri-map-pin-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.location}
            onChange={(e) => onFilterChange({ location: e.target.value })}
            placeholder="Şehir veya ilçe ara..."
            className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Durum */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Ürün Durumu</h4>
        <div className="space-y-2">
          {conditions.map(condition => (
            <label
              key={condition.id}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.condition.includes(condition.id)}
                onChange={() => toggleCondition(condition.id)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">{condition.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tarih */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">İlan Tarihi</h4>
        <select
          value={filters.dateRange}
          onChange={(e) => onFilterChange({ dateRange: e.target.value })}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          aria-label="İlan tarihi filtresi"
          title="İlan tarihi"
        >
          {dateRanges.map(range => (
            <option key={range.id} value={range.id}>
              {range.name}
            </option>
          ))}
        </select>
      </div>

      {/* Premium */}
      <div>
        <label className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 cursor-pointer hover:shadow-md transition-all">
          <input
            type="checkbox"
            checked={filters.isPremium}
            onChange={(e) => onFilterChange({ isPremium: e.target.checked })}
            className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
          />
          <div className="flex items-center space-x-2">
            <i className="ri-vip-crown-fill text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">Sadece Premium İlanlar</span>
          </div>
        </label>
      </div>
    </div>
  );
}

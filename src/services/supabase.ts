import { supabase } from '../lib/supabase';
import type { FilterState } from '../types/listing';

// Database listing type (from Supabase)
export interface DBListing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  location: string | null;
  condition: string;
  image_url: string | null;
  images: (
    | string
    | {
        image_url?: string;
        public_url?: string;
        url?: string;
        path?: string;
        metadata?: Record<string, unknown>;
      }
  )[];
  is_premium: boolean;
  views: number;
  created_at: string;
  status: string;
  user_id: string;
}

// Environment config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const USE_EDGE_FUNCTIONS = import.meta.env.VITE_USE_EDGE_FUNCTIONS !== 'false'; // default true

/**
 * Fetch listings via Edge Function (with fallback to direct client)
 */
async function fetchViaEdge(filters: FilterState): Promise<DBListing[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
    },
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    throw new Error(`Edge function error: ${response.status}`);
  }

  const result = await response.json();
  return result.listings || [];
}

/**
 * Fetch listings directly from Supabase (fallback)
 */
async function fetchDirect(filters: FilterState): Promise<DBListing[]> {
  try {
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active'); // Only active listings

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      query = query.in('category', filters.categories);
    }

    // Price range filter
    if (filters.priceRange && filters.priceRange.length === 2) {
      query = query
        .gte('price', filters.priceRange[0])
        .lte('price', filters.priceRange[1]);
    }

    // Location filter
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    // Condition filter
    if (filters.condition && filters.condition.length > 0) {
      query = query.in('condition', filters.condition);
    }

    // Premium filter
    if (filters.isPremium) {
      query = query.eq('is_premium', true);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      let dateThreshold: Date;

      switch (filters.dateRange) {
        case 'today':
          dateThreshold = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateThreshold = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          dateThreshold = new Date(0); // All time
      }

      query = query.gte('created_at', dateThreshold.toISOString());
    }

    // Sort by newest first
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching listings (direct):', error);
    throw error;
  }
}

/**
 * Fetch listings from Supabase with filters (Edge-first with fallback)
 */
export async function fetchListingsWithFilters(filters: FilterState): Promise<DBListing[]> {
  try {
    if (USE_EDGE_FUNCTIONS) {
      try {
        console.log('🚀 Fetching via Edge function...');
        return await fetchViaEdge(filters);
      } catch (edgeError) {
        console.warn('⚠️ Edge function failed, falling back to direct:', edgeError);
        return await fetchDirect(filters);
      }
    } else {
      console.log('📡 Fetching directly (Edge functions disabled)');
      return await fetchDirect(filters);
    }
  } catch (error) {
    console.error('Error fetching listings:', error);
    throw error;
  }
}

/**
 * Fetch single listing by ID
 */
export async function fetchListingById(id: string): Promise<DBListing | null> {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching listing:', error);
    return null;
  }
}

/**
 * Fetch all active listings (no filters)
 */
export async function fetchListings(): Promise<DBListing[]> {
  // Use fetchListingsWithFilters with empty filters for consistency
  return fetchListingsWithFilters({
    categories: [],
    priceRange: [0, 1000000],
    location: '',
    condition: [],
    isPremium: false,
    dateRange: 'all',
  });
}

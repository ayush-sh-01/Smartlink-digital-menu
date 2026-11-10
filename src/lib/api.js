import { supabase } from './supabase';

/**
 * Fetch restaurant details by its unique slug (for public customer QR menu)
 */
export async function getRestaurantBySlug(slug) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching restaurant by slug:', error);
    return null;
  }
  return data;
}

/**
 * Fetch all published active categories for a restaurant, ordered by sort_order
 */
export async function getCategoriesByRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data;
}

/**
 * Fetch visible menu items for a restaurant, ordered by sort_order
 */
export async function getMenuItemsByRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching menu items:', error);
    return [];
  }
  return data;
}

/**
 * Fetch active offers for a restaurant
 */
export async function getOffersByRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching offers:', error);
    return [];
  }
  return data;
}

/**
 * Upload food image to Supabase Storage in restaurant-partitioned path
 */
export async function uploadMenuImage(restaurantId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `${restaurantId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('menu-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('menu-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}


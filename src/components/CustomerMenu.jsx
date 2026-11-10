import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  getRestaurantBySlug,
  getCategoriesByRestaurant,
  getMenuItemsByRestaurant,
  getOffersByRestaurant
} from '../lib/api';

export default function CustomerMenu({ slug = 'smartlink' }) {
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('ALL'); // 'ALL', 'VEG', 'NON_VEG'
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Load menu data
  const loadMenuData = async () => {
    try {
      const rest = await getRestaurantBySlug(slug);
      if (!rest) {
        setLoading(false);
        return;
      }
      setRestaurant(rest);

      const [cats, items, offrs] = await Promise.all([
        getCategoriesByRestaurant(rest.id),
        getMenuItemsByRestaurant(rest.id),
        getOffersByRestaurant(rest.id)
      ]);

      setCategories(cats || []);
      setMenuItems(items || []);
      setOffers(offrs || []);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuData();

    // Setup Supabase Realtime channel for instant sync without reload
    const channel = supabase
      .channel(`customer-menu-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        loadMenuData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        loadMenuData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => {
        loadMenuData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        loadMenuData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin mb-3">
          progress_activity
        </span>
        <h2 className="font-serif text-2xl text-primary font-semibold">SmartLink</h2>
        <p className="text-sm text-on-surface-variant mt-1">Loading digital menu...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-error text-6xl mb-3">storefront</span>
        <h2 className="font-serif text-2xl text-primary font-bold">Restaurant Menu Not Found</h2>
        <p className="text-on-surface-variant text-sm mt-2 max-w-sm">
          The requested QR menu slug <code className="bg-surface-container px-2 py-1 rounded text-primary font-mono">{slug}</code> does not exist or is currently unpublished.
        </p>
        <a
          href="/owner"
          className="mt-6 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm shadow-md"
        >
          Go to Owner Atelier Portal
        </a>
      </div>
    );
  }

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    // Dietary filter
    if (dietaryFilter === 'VEG' && !item.is_veg) return false;
    if (dietaryFilter === 'NON_VEG' && item.is_veg) return false;

    // Category filter
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-md mx-auto shadow-2xl relative pb-16 font-sans">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">local_florist</span>
            <h1 className="font-serif text-xl font-bold text-primary tracking-tight">{restaurant.name}</h1>
          </div>
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
            {restaurant.tagline || 'Artisanal Botanical Dining'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {restaurant.is_published ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse"></span>
              Live Menu
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant text-[11px] font-semibold">
              Closed
            </span>
          )}
        </div>
      </header>

      {/* Special Offers Carousel / Banner */}
      {offers && offers.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-2xl p-4 shadow-md flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-widest text-secondary-container">
                Special Offer
              </span>
              <h3 className="font-serif text-lg font-bold mt-0.5">{offers[0].title}</h3>
              <p className="text-xs text-on-primary-container mt-0.5">{offers[0].description}</p>
            </div>
            {offers[0].discount_percentage && (
              <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary flex flex-col items-center justify-center font-serif font-black shadow-inner shrink-0 ml-2">
                <span className="text-base leading-none">{offers[0].discount_percentage}%</span>
                <span className="text-[9px] uppercase font-sans tracking-tight">OFF</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar & Dietary Filter Pills */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pasta, beverages, desserts..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-lowest text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Veg / Non-Veg Filter Switchers */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <button
            onClick={() => setDietaryFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
              dietaryFilter === 'ALL'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setDietaryFilter('VEG')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
              dietaryFilter === 'VEG'
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            Pure Veg
          </button>
          <button
            onClick={() => setDietaryFilter('NON_VEG')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
              dietaryFilter === 'NON_VEG'
                ? 'bg-tertiary-container text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Non-Veg
          </button>
        </div>
      </div>

      {/* Sticky Categories Navigation Bar */}
      <div className="sticky top-[61px] z-30 bg-surface/95 backdrop-blur-md px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-2 border-b border-surface-container shadow-sm">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
            selectedCategory === 'ALL'
              ? 'bg-primary-container text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:text-primary'
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              selectedCategory === cat.id
                ? 'bg-primary-container text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-primary'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Dishes List */}
      <main className="px-4 py-4 flex flex-col gap-3">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 text-outline">search_off</span>
            <p className="font-serif text-lg font-semibold text-primary">No Menu Items Found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm border border-surface-container flex gap-3 transition-all relative overflow-hidden ${
                !item.is_available ? 'opacity-75 grayscale-[20%]' : ''
              }`}
            >
              {/* Food Image */}
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-surface-container shrink-0 relative">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-3xl">restaurant</span>
                  </div>
                )}

                {/* Dietary Veg / Non-Veg dot */}
                <div className="absolute top-1.5 left-1.5 bg-white/90 p-0.5 rounded shadow-sm">
                  <div
                    className={`w-3 h-3 border flex items-center justify-center ${
                      item.is_veg ? 'border-emerald-600' : 'border-red-600'
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Dish Details */}
              <div className="flex flex-col flex-1 min-w-0 justify-between">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-serif text-[16px] font-bold text-primary leading-tight line-clamp-1">
                      {item.name}
                    </h3>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.is_todays_special && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                        Today's Special
                      </span>
                    )}
                    {item.is_bestseller && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                        Bestseller
                      </span>
                    )}
                    {item.is_chefs_special && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
                        Chef's Special
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Price & Availability Status */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-surface-container">
                  <span className="font-serif text-[17px] font-bold text-primary">
                    ₹{Number(item.price).toLocaleString('en-IN')}
                  </span>

                  {item.is_available ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-error bg-error-container px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Footer Branding */}
      <footer className="mt-auto py-6 text-center border-t border-surface-container-high px-4">
        <p className="font-serif text-sm font-semibold text-primary">{restaurant.name}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          Digital QR Menu • Instant Realtime Sync Active
        </p>
      </footer>
    </div>
  );
}


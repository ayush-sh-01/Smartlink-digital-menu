import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCategoriesByRestaurant,
  getMenuItemsByRestaurant,
  getOffersByRestaurant
} from '../lib/api';
import ItemModal from './ItemModal';
import CategoryModal from './CategoryModal';
import OfferModal from './OfferModal';
import QRCodeModal from './QRCodeModal';
import OwnerAuthModal from './OwnerAuthModal';

export default function OwnerDashboard() {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  // Filters inside Owner dashboard
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Restaurant Creation state for first time owner
  const [newRestName, setNewRestName] = useState('SmartLink');
  const [newRestSlug, setNewRestSlug] = useState('smartlink');
  const [newRestTagline, setNewRestTagline] = useState('Smart Digital Dining Experience');
  const [creatingRest, setCreatingRest] = useState(false);
  const [createRestError, setCreateRestError] = useState('');

  // Initial Auth Check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setUser(data.session.user);
        loadOwnerRestaurant(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadOwnerRestaurant(session.user.id);
      } else {
        setUser(null);
        setRestaurant(null);
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Fetch or create owner restaurant
  const loadOwnerRestaurant = async (ownerId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const rest = data[0];
        setRestaurant(rest);
        await loadMenuData(rest.id);
      } else {
        setRestaurant(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuData = async (restId) => {
    const [cats, items, offrs] = await Promise.all([
      getCategoriesByRestaurant(restId),
      getMenuItemsByRestaurant(restId),
      getOffersByRestaurant(restId)
    ]);
    setCategories(cats || []);
    setMenuItems(items || []);
    setOffers(offrs || []);
  };

  // Create restaurant profile for newly authenticated owner
  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    if (!user) return;
    setCreatingRest(true);
    setCreateRestError('');

    try {
      const formattedSlug = newRestSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          owner_id: user.id,
          name: newRestName.trim(),
          slug: formattedSlug,
          tagline: newRestTagline.trim(),
          is_published: true
        })
        .select()
        .single();

      if (error) throw error;
      setRestaurant(data);

      // Seed initial default categories for convenience
      const defaultCats = [
        { restaurant_id: data.id, name: 'Starters', sort_order: 1 },
        { restaurant_id: data.id, name: 'Handcrafted Pasta', sort_order: 2 },
        { restaurant_id: data.id, name: 'Artisanal Mains', sort_order: 3 },
        { restaurant_id: data.id, name: 'Desserts & Teas', sort_order: 4 }
      ];
      await supabase.from('categories').insert(defaultCats);

      await loadMenuData(data.id);
    } catch (err) {
      console.error(err);
      setCreateRestError(err.message || 'Failed to create restaurant');
    } finally {
      setCreatingRest(false);
    }
  };

  // Toggle Item Availability (Out of stock vs Available)
  const handleToggleAvailability = async (itemId, currentVal) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentVal })
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_available: !currentVal } : i))
      );
    } catch (err) {
      alert('Error updating availability: ' + err.message);
    }
  };

  // Toggle Item Visibility (Show vs Hide on Menu)
  const handleToggleVisibility = async (itemId, currentVal) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_visible: !currentVal })
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_visible: !currentVal } : i))
      );
    } catch (err) {
      alert('Error updating visibility: ' + err.message);
    }
  };

  // Delete Dish
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
      if (error) throw error;
      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      alert('Error deleting item: ' + err.message);
    }
  };

  // Toggle Restaurant Published Status
  const handleTogglePublished = async () => {
    if (!restaurant) return;
    try {
      const nextVal = !restaurant.is_published;
      const { error } = await supabase
        .from('restaurants')
        .update({ is_published: nextVal })
        .eq('id', restaurant.id);
      if (error) throw error;
      setRestaurant({ ...restaurant, is_published: nextVal });
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Filter items
  const filteredItems = menuItems.filter((i) => {
    if (selectedCategory !== 'ALL' && i.category_id !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface flex flex-col">
      {/* Top Owner Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">local_cafe</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl font-bold text-primary leading-tight">
                  {restaurant ? restaurant.name : 'SmartLink'}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[10px] font-bold uppercase tracking-wider">
                  Menu Manager
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                {restaurant ? `Slug: /${restaurant.slug}` : 'Digital Menu Atelier Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {restaurant && (
                  <>
                    <button
                      onClick={() => setIsQROpen(true)}
                      className="px-3 py-2 bg-surface-container hover:bg-surface-container-high text-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                      <span className="hidden md:inline">Table QR Standee</span>
                    </button>

                    <a
                      href={`/?menu=${restaurant.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-secondary text-on-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                      <span className="hidden md:inline">Preview Customer Menu</span>
                    </a>
                  </>
                )}

                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 hover:opacity-95"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Owner Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
        {!user ? (
          /* Unauthenticated Landing */
          <div className="py-16 flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center mb-4 shadow-md">
              <span className="material-symbols-outlined text-3xl">menu_book</span>
            </div>
            <h2 className="font-serif text-3xl font-bold text-primary">Digital Menu Atelier</h2>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              Manage à la carte food items, categories, seasonal discounts, and live stock availability in real-time. Customers view your latest menu instantly through permanent QR codes.
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="mt-6 px-6 py-3 bg-primary-container hover:bg-primary text-on-primary font-semibold text-sm rounded-xl shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">lock_open</span>
              <span>Sign In to Access Atelier</span>
            </button>
          </div>
        ) : !restaurant ? (
          /* First-time Owner: Create Restaurant Profile */
          <div className="max-w-md mx-auto bg-surface-container-lowest p-6 rounded-2xl shadow-xl border border-surface-container my-8">
            <h2 className="font-serif text-2xl font-bold text-primary mb-1">Set Up Your Restaurant</h2>
            <p className="text-xs text-on-surface-variant mb-4">
              Create your permanent digital menu profile and generate your QR codes.
            </p>

            {createRestError && (
              <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs font-semibold">
                {createRestError}
              </div>
            )}

            <form onSubmit={handleCreateRestaurant} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Restaurant Name</label>
                <input
                  type="text"
                  required
                  value={newRestName}
                  onChange={(e) => {
                    setNewRestName(e.target.value);
                    setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                  placeholder="e.g. SmartLink"
                  className="w-full h-10 px-3 rounded-xl bg-surface border text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Permanent QR Slug (cannot be changed once created)
                </label>
                <div className="flex items-center">
                  <span className="h-10 px-3 bg-surface-container border border-r-0 rounded-l-xl text-xs text-outline flex items-center font-mono">
                    /menu/
                  </span>
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    value={newRestSlug}
                    onChange={(e) => setNewRestSlug(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-r-xl bg-surface border text-xs font-mono text-primary font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Tagline</label>
                <input
                  type="text"
                  value={newRestTagline}
                  onChange={(e) => setNewRestTagline(e.target.value)}
                  placeholder="e.g. Botanical Glasshouse & Artisanal Bistro"
                  className="w-full h-10 px-3 rounded-xl bg-surface border text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={creatingRest}
                className="w-full h-11 mt-3 bg-primary-container text-on-primary font-semibold text-xs rounded-xl shadow-md hover:bg-primary flex items-center justify-center gap-2"
              >
                {creatingRest && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                <span>Launch Digital Menu</span>
              </button>
            </form>
          </div>
        ) : (
          /* Main Dashboard Controls */
          <div className="flex flex-col gap-6">
            {/* Quick Metrics & Actions Bar */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-2xl font-bold text-primary">{restaurant.name}</h2>
                  <label className="inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={restaurant.is_published}
                      onChange={handleTogglePublished}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2 text-xs font-semibold text-on-surface">
                      {restaurant.is_published ? 'Menu Published' : 'Menu Hidden'}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Permanent QR: <span className="font-mono text-primary">/?menu={restaurant.slug}</span> • Live Realtime Active
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">category</span>
                  <span>Categories ({categories.length})</span>
                </button>

                <button
                  onClick={() => setIsOfferModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">local_offer</span>
                  <span>Special Offers ({offers.length})</span>
                </button>

                <button
                  onClick={() => {
                    setItemToEdit(null);
                    setIsItemModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-semibold text-xs flex items-center gap-1.5 shadow-md hover:bg-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Add Food Item</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Category selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                    selectedCategory === 'ALL'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-primary'
                  }`}
                >
                  All ({menuItems.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                      selectedCategory === c.id
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter dishes..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-container-lowest border text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-surface-container">
                <span className="material-symbols-outlined text-4xl mb-2 text-outline">restaurant_menu</span>
                <p className="font-serif text-lg font-semibold text-primary">No Menu Items Found</p>
                <p className="text-xs mt-1">Click "+ Add Food Item" to add your first dish.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const cat = categories.find((c) => c.id === item.category_id);
                  return (
                    <div
                      key={item.id}
                      className={`bg-surface-container-lowest rounded-2xl p-4 border border-surface-container shadow-sm flex flex-col justify-between transition-all ${
                        !item.is_available ? 'border-amber-200 bg-amber-50/20' : ''
                      }`}
                    >
                      <div>
                        {/* Image & Quick Info */}
                        <div className="flex gap-3">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-container shrink-0 relative">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-outline">
                                <span className="material-symbols-outlined text-2xl">restaurant</span>
                              </div>
                            )}

                            <div className="absolute top-1 left-1 bg-white/90 p-0.5 rounded shadow-sm">
                              <div
                                className={`w-2.5 h-2.5 border flex items-center justify-center ${
                                  item.is_veg ? 'border-emerald-600' : 'border-red-600'
                                }`}
                              >
                                <div
                                  className={`w-1 h-1 rounded-full ${
                                    item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                                  }`}
                                ></div>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                              {cat?.name || 'Uncategorized'}
                            </span>
                            <h3 className="font-serif text-base font-bold text-primary truncate leading-snug">
                              {item.name}
                            </h3>
                            <p className="font-serif text-base font-bold text-primary mt-0.5">
                              ₹{Number(item.price).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.is_todays_special && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                              Special
                            </span>
                          )}
                          {item.is_bestseller && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase">
                              Bestseller
                            </span>
                          )}
                          {item.is_chefs_special && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold uppercase">
                              Chef's
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-on-surface-variant line-clamp-2 mt-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Controls Footer */}
                      <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-2">
                        {/* Availability Toggle */}
                        <button
                          onClick={() => handleToggleAvailability(item.id, item.is_available)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            item.is_available
                              ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-error-container text-error hover:bg-red-100'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.is_available ? 'bg-emerald-600' : 'bg-error'
                            }`}
                          ></span>
                          <span>{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Hide / Show on Menu */}
                          <button
                            title={item.is_visible ? 'Visible on menu' : 'Hidden from menu'}
                            onClick={() => handleToggleVisibility(item.id, item.is_visible)}
                            className={`p-1.5 rounded-lg text-sm material-symbols-outlined ${
                              item.is_visible
                                ? 'text-on-surface-variant hover:text-primary'
                                : 'text-outline bg-surface-container'
                            }`}
                          >
                            {item.is_visible ? 'visibility' : 'visibility_off'}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setItemToEdit(item);
                              setIsItemModalOpen(true);
                            }}
                            className="p-1.5 text-on-surface-variant hover:text-primary material-symbols-outlined text-[18px]"
                          >
                            edit
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-on-surface-variant hover:text-error material-symbols-outlined text-[18px]"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <OwnerAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadOwnerRestaurant(u.id);
        }}
      />

      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        restaurantId={restaurant?.id}
        categories={categories}
        itemToEdit={itemToEdit}
        onSaved={() => loadMenuData(restaurant.id)}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        restaurantId={restaurant?.id}
        categories={categories}
        onSaved={() => loadMenuData(restaurant.id)}
      />

      <OfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        restaurantId={restaurant?.id}
        offers={offers}
        onSaved={() => loadMenuData(restaurant.id)}
      />

      <QRCodeModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        restaurant={restaurant}
      />
    </div>
  );
}


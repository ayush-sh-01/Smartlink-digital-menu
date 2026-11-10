import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadMenuImage } from '../lib/api';

export default function ItemModal({ isOpen, onClose, restaurantId, categories, itemToEdit, onSaved }) {
  if (!isOpen) return null;

  const isEditing = !!itemToEdit;
  const [name, setName] = useState(itemToEdit?.name || '');
  const [description, setDescription] = useState(itemToEdit?.description || '');
  const [price, setPrice] = useState(itemToEdit?.price || '');
  const [categoryId, setCategoryId] = useState(itemToEdit?.category_id || categories[0]?.id || '');
  const [isVeg, setIsVeg] = useState(itemToEdit ? itemToEdit.is_veg : true);
  const [isAvailable, setIsAvailable] = useState(itemToEdit ? itemToEdit.is_available : true);
  const [isVisible, setIsVisible] = useState(itemToEdit ? itemToEdit.is_visible : true);
  const [isTodaysSpecial, setIsTodaysSpecial] = useState(itemToEdit?.is_todays_special || false);
  const [isBestseller, setIsBestseller] = useState(itemToEdit?.is_bestseller || false);
  const [isChefsSpecial, setIsChefsSpecial] = useState(itemToEdit?.is_chefs_special || false);
  const [imageUrl, setImageUrl] = useState(itemToEdit?.image_url || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    try {
      const publicUrl = await uploadMenuImage(restaurantId, file);
      setImageUrl(publicUrl);
    } catch (err) {
      console.error(err);
      setErrorMsg('Image upload failed: ' + (err.message || 'Check storage permissions'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg('Please select a category first.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        image_url: imageUrl || null,
        is_veg: isVeg,
        is_available: isAvailable,
        is_visible: isVisible,
        is_todays_special: isTodaysSpecial,
        is_bestseller: isBestseller,
        is_chefs_special: isChefsSpecial
      };

      if (isEditing) {
        const { error } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', itemToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert(payload);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save menu item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-surface-container relative my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="font-serif text-2xl font-bold text-primary mb-1">
          {isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}
        </h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Changes will instantly sync to all scanned customer table QR codes.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Dish Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Handmade Truffle Agnolotti"
                className="w-full h-10 px-3 rounded-xl bg-surface border border-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1270.00"
                className="w-full h-10 px-3 rounded-xl bg-surface border border-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Dietary Tag</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsVeg(true)}
                  className={`flex-1 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isVeg
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                      : 'bg-surface border-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Pure Veg
                </button>
                <button
                  type="button"
                  onClick={() => setIsVeg(false)}
                  className={`flex-1 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    !isVeg
                      ? 'bg-red-50 border-red-600 text-red-800'
                      : 'bg-surface border-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  Non-Veg
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fresh artisanal ingredients, micro herbs, truffle butter glaze..."
              className="w-full p-2.5 rounded-xl bg-surface border border-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Image Upload / URL */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Dish Image</label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container border shrink-0 relative">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-0 right-0 bg-black/60 text-white p-0.5 rounded-bl text-[12px]"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="w-full h-16 border-2 border-dashed border-surface-container rounded-xl flex items-center justify-center gap-2 text-on-surface-variant cursor-pointer hover:bg-surface text-xs">
                  <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                  <span>{uploading ? 'Uploading to Supabase...' : 'Upload Image (5MB max)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Toggles & Badges */}
          <div className="bg-surface rounded-xl p-3 border border-surface-container flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Item Visibility &amp; Badges
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="font-medium text-on-surface">Available in Kitchen</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="font-medium text-on-surface">Visible on Menu</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTodaysSpecial}
                  onChange={(e) => setIsTodaysSpecial(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-on-surface">Today's Special</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBestseller}
                  onChange={(e) => setIsBestseller(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-medium text-on-surface">Bestseller</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChefsSpecial}
                  onChange={(e) => setIsChefsSpecial(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-on-surface">Chef's Special</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 h-11 bg-primary-container hover:bg-primary text-on-primary rounded-xl font-semibold text-xs shadow-md flex items-center justify-center gap-2"
            >
              {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              <span>{isEditing ? 'Save Changes' : 'Publish Dish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


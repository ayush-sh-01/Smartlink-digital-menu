import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function OfferModal({ isOpen, onClose, restaurantId, offers, onSaved }) {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddOffer = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('offers').insert({
        restaurant_id: restaurantId,
        title: title.trim(),
        description: description.trim(),
        discount_percentage: discountPercentage ? parseInt(discountPercentage, 10) : null,
        promo_code: promoCode.trim() || null,
        is_active: true
      });
      if (error) throw error;
      setTitle('');
      setDescription('');
      setDiscountPercentage('');
      setPromoCode('');
      onSaved();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add offer');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId) => {
    try {
      const { error } = await supabase.from('offers').delete().eq('id', offerId);
      if (error) throw error;
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleToggleOffer = async (offerId, currentActive) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ is_active: !currentActive })
        .eq('id', offerId);
      if (error) throw error;
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-surface-container relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="font-serif text-2xl font-bold text-primary mb-1">Special Offers &amp; Promos</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Highlight tasting deals &amp; seasonal percentage discounts on your digital menu.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAddOffer} className="flex flex-col gap-3 mb-4 bg-surface p-3.5 rounded-xl border border-surface-container">
          <div>
            <label className="block text-[11px] font-semibold text-on-surface mb-1">Offer Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunset Tasting Deal"
              className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-on-surface mb-1">Discount %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                placeholder="20"
                className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-on-surface mb-1">Promo Code</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="SMART20"
                className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border text-xs uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-on-surface mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Valid on handmade pasta & artisanal infusions"
              className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-sm hover:bg-primary"
          >
            + Create Special Offer
          </button>
        </form>

        {/* Existing Offers */}
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {offers.length === 0 ? (
            <p className="text-center text-xs text-outline py-2">No active special offers.</p>
          ) : (
            offers.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-surface-container"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-primary">{o.title}</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {o.discount_percentage ? `${o.discount_percentage}% OFF` : ''} {o.promo_code ? `• Code: ${o.promo_code}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleOffer(o.id, o.is_active)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      o.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-outline'
                    }`}
                  >
                    {o.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => handleDeleteOffer(o.id)}
                    className="p-1 text-on-surface-variant hover:text-error material-symbols-outlined text-[16px]"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 mt-4 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl"
        >
          Close
        </button>
      </div>
    </div>
  );
}


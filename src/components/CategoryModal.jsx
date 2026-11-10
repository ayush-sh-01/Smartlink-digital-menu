import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CategoryModal({ isOpen, onClose, restaurantId, categories, onSaved }) {
  if (!isOpen) return null;

  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const nextSort = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 : 1;
      const { error } = await supabase.from('categories').insert({
        restaurant_id: restaurantId,
        name: newCatName.trim(),
        sort_order: nextSort,
        is_active: true
      });
      if (error) throw error;
      setNewCatName('');
      onSaved();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (catId) => {
    if (!editingName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editingName.trim() })
        .eq('id', catId);
      if (error) throw error;
      setEditingId(null);
      onSaved();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category? (Note: Items in this category will prevent deletion).')) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
      onSaved();
    } catch (err) {
      setErrorMsg(err.message.includes('restrict')
        ? 'Cannot delete category containing food items. Please move or delete items first.'
        : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (catId, currentActive) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !currentActive })
        .eq('id', catId);
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

        <h2 className="font-serif text-2xl font-bold text-primary mb-1">Manage Categories</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Organize courses and digital menu sections.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
          <input
            type="text"
            required
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New Category (e.g. Desserts)"
            className="flex-1 h-10 px-3.5 rounded-xl bg-surface border border-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 h-10 bg-primary-container text-on-primary font-semibold text-xs rounded-xl shadow-sm hover:bg-primary shrink-0"
          >
            + Add
          </button>
        </form>

        {/* Category List */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {categories.length === 0 ? (
            <p className="text-center text-xs text-outline py-4">No categories added yet.</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-surface-container gap-2"
              >
                {editingId === c.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 h-8 px-2 rounded-lg bg-surface-container-lowest text-xs border"
                    />
                    <button
                      onClick={() => handleUpdateCategory(c.id)}
                      className="px-2.5 h-8 bg-primary text-on-primary rounded-lg text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 h-8 text-on-surface-variant text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-outline cursor-grab">
                        drag_indicator
                      </span>
                      <span className={`text-xs font-semibold ${c.is_active ? 'text-primary' : 'text-outline line-through'}`}>
                        {c.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        title={c.is_active ? 'Hide from Menu' : 'Show on Menu'}
                        onClick={() => handleToggleActive(c.id, c.is_active)}
                        className={`p-1 rounded-lg text-[16px] material-symbols-outlined ${
                          c.is_active ? 'text-emerald-700 bg-emerald-50' : 'text-outline bg-surface-container'
                        }`}
                      >
                        {c.is_active ? 'visibility' : 'visibility_off'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                        className="p-1 text-on-surface-variant hover:text-primary material-symbols-outlined text-[16px]"
                      >
                        edit
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-1 text-on-surface-variant hover:text-error material-symbols-outlined text-[16px]"
                      >
                        delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 mt-5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl"
        >
          Done
        </button>
      </div>
    </div>
  );
}


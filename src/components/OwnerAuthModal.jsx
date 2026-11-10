import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function OwnerAuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          onAuthSuccess(data.session.user);
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onAuthSuccess(data.session.user);
          onClose();
        } else {
          setErrorMsg('Signup successful! Please check your email for confirmation or sign in directly.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
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

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center mb-2 shadow-sm">
            <span className="material-symbols-outlined text-2xl">local_cafe</span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-primary">
            {isLogin ? 'Owner Atelier Login' : 'Create Owner Account'}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {isLogin
              ? 'Enter credentials to manage your digital restaurant menu'
              : 'Sign up to launch and manage your digital QR menu'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-error text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@smartlink.com"
              className="w-full h-11 px-3.5 rounded-xl bg-surface border border-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3.5 rounded-xl bg-surface border border-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-primary-container hover:bg-primary text-on-primary font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
            <span>{isLogin ? 'Sign In to Dashboard' : 'Create Atelier Account'}</span>
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg('');
            }}
            className="text-xs text-secondary font-semibold hover:underline"
          >
            {isLogin ? "Don't have an owner account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import CustomerMenu from './components/CustomerMenu';
import OwnerDashboard from './components/OwnerDashboard';

export default function App() {
  /**
   * Routing Logic:
   * 1. Customer Mode (Default): When scanning QR or browsing normal URLs (/ or /?menu=slug or /menu/slug)
   * 2. Owner Mode: ONLY when explicitly navigating to the dedicated owner URL: /owner or /admin
   * 
   * SECURITY: No owner floating buttons or switcher links are rendered on the customer menu.
   * Customers scanning the table QR code will ONLY see the clean restaurant menu.
   */
  const getInitialView = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.toLowerCase();

    // Explicit owner paths only
    if (path === '/owner' || path === '/admin') {
      return { mode: 'owner', slug: null };
    }

    // Customer Menu path
    if (params.get('menu')) {
      return { mode: 'customer', slug: params.get('menu') };
    }
    if (path.startsWith('/menu/')) {
      const slug = path.replace('/menu/', '').trim();
      return { mode: 'customer', slug: slug || 'smartlink' };
    }

    // Default: Customer Menu
    return { mode: 'customer', slug: 'smartlink' };
  };

  const [route, setRoute] = useState(getInitialView);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="relative min-h-screen bg-surface">
      {/* 
        CLEAN SEPARATION:
        When a customer scans QR, they will ONLY see CustomerMenu.
        No admin buttons, no login options, no switcher.
      */}
      {route.mode === 'customer' ? (
        <CustomerMenu slug={route.slug || 'smartlink'} />
      ) : (
        <OwnerDashboard />
      )}
    </div>
  );
}

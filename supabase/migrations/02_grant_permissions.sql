-- ==============================================================================
-- GRANT STANDARD TABLE PRIVILEGES TO POSTGRES ROLES
-- In PostgreSQL, RLS policies require base table privileges (SELECT/INSERT/UPDATE/DELETE)
-- ==============================================================================

-- 1. Grant base SELECT to anon (customers) and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.restaurants TO anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT SELECT ON TABLE public.menu_items TO anon, authenticated;
GRANT SELECT ON TABLE public.offers TO anon, authenticated;

-- 2. Grant full CRUD to authenticated users (Owner operations governed by RLS)
GRANT INSERT, UPDATE, DELETE ON TABLE public.restaurants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.menu_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;

-- Ensure future tables inherit appropriate schema privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;


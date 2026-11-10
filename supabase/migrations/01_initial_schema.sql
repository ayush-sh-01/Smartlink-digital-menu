-- ==============================================================================
-- RESTAURANT DIGITAL MENU SYSTEM - PRODUCTION POSTGRESQL SCHEMA (SECURITY HARDENED)
-- Core Tables: restaurants, categories, menu_items, offers
-- Scope: Digital Menu Management ONLY (NO Ordering, NO Cart, NO Payments)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========
===================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 2.1 Automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Protect permanent restaurant slug & validate slug format
CREATE OR REPLACE FUNCTION public.validate_and_protect_restaurant_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate slug format: lowercase letters, numbers, and hyphens only, 3-63 chars
    IF NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(NEW.slug) < 3 OR length(NEW.slug) > 63 THEN
        RAISE EXCEPTION 'Invalid slug format. Slug must be lowercase alphanumeric with hyphens (e.g. brew-bloom), 3-63 characters.';
    END IF;

    -- On UPDATE: Permanently lock slug against modifications (preserves printed QR codes)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.slug IS DISTINCT FROM NEW.slug THEN
            RAISE EXCEPTION 'Permanent QR slug cannot be modified once created. Re-generate QR is prohibited.';
        END IF;
        -- Prevent changing the owner_id of an existing restaurant
        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            RAISE EXCEPTION 'Restaurant ownership cannot be transferred directly.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.3 Prevent modifying restaurant_id on categories, menu_items, and offers
CREATE OR REPLACE FUNCTION public.prevent_restaurant_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id THEN
        RAISE EXCEPTION 'Records cannot be moved to a different restaurant.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. CORE TABLES
-- ==============================================================================

-- 3.1 TABLE: RESTAURANTS
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug TEXT UNIQUE NOT NULL,
    tagline TEXT DEFAULT '',
    logo_url TEXT,
    banner_url TEXT,
    phone TEXT,
    address TEXT,
    is_published BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Slug & Ownership protection trigger
DROP TRIGGER IF EXISTS tr_validate_protect_restaurant_slug ON public.restaurants;
CREATE TRIGGER tr_validate_protect_restaurant_slug
    BEFORE INSERT OR UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_restaurant_slug();

-- updated_at trigger
DROP TRIGGER IF EXISTS tr_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER tr_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Index for public slug lookup via QR code
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);


-- 3.2 TABLE: CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    description TEXT,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    -- Composite unique key guarantees cross-tenant category validation
    CONSTRAINT uq_categories_id_restaurant UNIQUE (id, restaurant_id)
);

-- Prevent cross-tenant moves
DROP TRIGGER IF EXISTS tr_categories_lock_restaurant ON public.categories;
CREATE TRIGGER tr_categories_lock_restaurant
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_restaurant_id_change();

DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort ON public.categories(restaurant_id, sort_order);


-- 3.3 TABLE: MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    category_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    description TEXT DEFAULT '',
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_veg BOOLEAN DEFAULT true NOT NULL,
    is_available BOOLEAN DEFAULT true NOT NULL, -- Available vs Out of Stock
    is_visible BOOLEAN DEFAULT true NOT NULL,   -- Active on Menu vs Hidden
    is_todays_special BOOLEAN DEFAULT false NOT NULL,
    is_bestseller BOOLEAN DEFAULT false NOT NULL,
    is_chefs_special BOOLEAN DEFAULT false NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Foreign key to category: ON DELETE RESTRICT prevents accidental item loss
    -- Also strictly validates that category belongs to the EXACT same restaurant
    CONSTRAINT fk_menu_item_category_restaurant 
        FOREIGN KEY (category_id, restaurant_id) 
        REFERENCES public.categories(id, restaurant_id) 
        ON DELETE RESTRICT
);

-- Prevent cross-tenant moves
DROP TRIGGER IF EXISTS tr_menu_items_lock_restaurant ON public.menu_items;
CREATE TRIGGER tr_menu_items_lock_restaurant
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_restaurant_id_change();

DROP TRIGGER IF EXISTS tr_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER tr_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_menu_items_category_sort ON public.menu_items(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);


-- 3.4 TABLE: OFFERS
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
    description TEXT DEFAULT '',
    discount_percentage INTEGER CHECK (discount_percentage BETWEEN 1 AND 100),
    promo_code TEXT,
    start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT chk_offer_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Prevent cross-tenant moves
DROP TRIGGER IF EXISTS tr_offers_lock_restaurant ON public.offers;
CREATE TRIGGER tr_offers_lock_restaurant
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_restaurant_id_change();

DROP TRIGGER IF EXISTS tr_offers_updated_at ON public.offers;
CREATE TRIGGER tr_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_offers_restaurant_active ON public.offers(restaurant_id, is_active);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4.1 PUBLIC READ-ONLY POLICIES (No login needed, SELECT only)
-- ------------------------------------------------------------------------------
-- Public can view published restaurants
DROP POLICY IF EXISTS "Public can view published restaurants" ON public.restaurants;
CREATE POLICY "Public can view published restaurants"
    ON public.restaurants FOR SELECT
    TO anon, authenticated
    USING (is_published = true);

-- Public can view active categories of published restaurants
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true 
        AND EXISTS (
            SELECT 1 FROM public.restaurants r 
            WHERE r.id = categories.restaurant_id AND r.is_published = true
        )
    );

-- Public can view visible menu items (both available and out-of-stock items!)
-- Hidden items (is_visible = false) or items in hidden categories remain inaccessible
DROP POLICY IF EXISTS "Public can view visible menu items" ON public.menu_items;
CREATE POLICY "Public can view visible menu items"
    ON public.menu_items FOR SELECT
    TO anon, authenticated
    USING (
        is_visible = true
        AND EXISTS (
            SELECT 1 FROM public.categories c
            JOIN public.restaurants r ON r.id = c.restaurant_id
            WHERE c.id = menu_items.category_id 
              AND c.is_active = true 
              AND r.is_published = true
        )
    );

-- Public can view active offers within valid date window
DROP POLICY IF EXISTS "Public can view active offers" ON public.offers;
CREATE POLICY "Public can view active offers"
    ON public.offers FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND (start_date <= now())
        AND (end_date IS NULL OR end_date >= now())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r 
            WHERE r.id = offers.restaurant_id AND r.is_published = true
        )
    );

-- ------------------------------------------------------------------------------
-- 4.2 OWNER CRUD POLICIES (Authenticated owners only, strict owner_id verification)
-- ------------------------------------------------------------------------------

-- RESTAURANTS:
DROP POLICY IF EXISTS "Owners can view own restaurant" ON public.restaurants;
CREATE POLICY "Owners can view own restaurant"
    ON public.restaurants FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert own restaurant" ON public.restaurants;
CREATE POLICY "Owners can insert own restaurant"
    ON public.restaurants FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update own restaurant" ON public.restaurants;
CREATE POLICY "Owners can update own restaurant"
    ON public.restaurants FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete own restaurant" ON public.restaurants;
CREATE POLICY "Owners can delete own restaurant"
    ON public.restaurants FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- CATEGORIES:
DROP POLICY IF EXISTS "Owners can view own categories" ON public.categories;
CREATE POLICY "Owners can view own categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can insert own categories" ON public.categories;
CREATE POLICY "Owners can insert own categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can update own categories" ON public.categories;
CREATE POLICY "Owners can update own categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can delete own categories" ON public.categories;
CREATE POLICY "Owners can delete own categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()
        )
    );

-- MENU ITEMS:
DROP POLICY IF EXISTS "Owners can view own menu items" ON public.menu_items;
CREATE POLICY "Owners can view own menu items"
    ON public.menu_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can insert own menu items" ON public.menu_items;
CREATE POLICY "Owners can insert own menu items"
    ON public.menu_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can update own menu items" ON public.menu_items;
CREATE POLICY "Owners can update own menu items"
    ON public.menu_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can delete own menu items" ON public.menu_items;
CREATE POLICY "Owners can delete own menu items"
    ON public.menu_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
        )
    );

-- OFFERS:
DROP POLICY IF EXISTS "Owners can view own offers" ON public.offers;
CREATE POLICY "Owners can view own offers"
    ON public.offers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = offers.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can insert own offers" ON public.offers;
CREATE POLICY "Owners can insert own offers"
    ON public.offers FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = offers.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can update own offers" ON public.offers;
CREATE POLICY "Owners can update own offers"
    ON public.offers FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = offers.restaurant_id AND r.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = offers.restaurant_id AND r.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can delete own offers" ON public.offers;
CREATE POLICY "Owners can delete own offers"
    ON public.offers FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = offers.restaurant_id AND r.owner_id = auth.uid()
        )
    );

-- ==============================================================================
-- 5. IDEMPOTENT REALTIME PUBLICATION CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
    -- Add tables to supabase_realtime publication only if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'offers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;
    END IF;
END $$;

-- Set replica identity to FULL so Realtime updates broadcast complete row records
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.offers REPLICA IDENTITY FULL;

-- ==============================================================================
-- 6. STORAGE BUCKET & STRICT FOLDER-PATH STORAGE POLICIES
-- ==============================================================================

-- Create public bucket 'menu-images' if not already created
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'menu-images',
    'menu-images',
    true,
    5242880, -- 5 MB limit per image
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- 6.1 Public read access for menu images
DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
CREATE POLICY "Public can view menu images"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'menu-images');

-- 6.2 Strict Owner Upload:
-- File path convention: '<restaurant_id>/<filename>'
-- Owner can ONLY upload to a folder named with their own restaurant UUID
DROP POLICY IF EXISTS "Owners can upload images to own restaurant folder" ON storage.objects;
CREATE POLICY "Owners can upload images to own restaurant folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND r.owner_id = auth.uid()
        )
    );

-- 6.3 Strict Owner Update
DROP POLICY IF EXISTS "Owners can update images in own restaurant folder" ON storage.objects;
CREATE POLICY "Owners can update images in own restaurant folder"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND r.owner_id = auth.uid()
        )
    );

-- 6.4 Strict Owner Delete
DROP POLICY IF EXISTS "Owners can delete images in own restaurant folder" ON storage.objects;
CREATE POLICY "Owners can delete images in own restaurant folder"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND r.owner_id = auth.uid()
        )
    );

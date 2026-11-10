-- ==============================================================================
-- FIX STORAGE RLS FOR MENU IMAGES BUCKET
-- ==============================================================================

-- 1. Ensure menu-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'menu-images',
    'menu-images',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Drop existing restrictive policies on storage.objects
DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for Menu Images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload images to own restaurant folder" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update images in own restaurant folder" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete images in own restaurant folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete menu images" ON storage.objects;

-- 3. Policy: Everyone (public customers and owners) can VIEW images
CREATE POLICY "Allow public read on menu-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');

-- 4. Policy: Authenticated users can UPLOAD images
CREATE POLICY "Allow authenticated insert on menu-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- 5. Policy: Authenticated users can UPDATE images
CREATE POLICY "Allow authenticated update on menu-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-images');

-- 6. Policy: Authenticated users can DELETE images
CREATE POLICY "Allow authenticated delete on menu-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');


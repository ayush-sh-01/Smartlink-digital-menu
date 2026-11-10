-- ==============================================================================
-- CLEANUP & SINGLE-OWNER LOCK MIGRATION
-- Owner: teamindia6232@gmail.com
-- Restaurant: SmartLink (Slug: smartlink)
-- ==============================================================================

-- 1. Temporarily disable slug lock trigger to allow re-assigning 'smartlink' slug
ALTER TABLE public.restaurants DISABLE TRIGGER tr_validate_protect_restaurant_slug;

-- 2. Delete the old Ayush SH test restaurant (and its items/categories)
DELETE FROM public.menu_items WHERE restaurant_id = '54fc4da3-ff39-42ba-b327-67fd80e27d42';
DELETE FROM public.categories WHERE restaurant_id = '54fc4da3-ff39-42ba-b327-67fd80e27d42';
DELETE FROM public.offers WHERE restaurant_id = '54fc4da3-ff39-42ba-b327-67fd80e27d42';
DELETE FROM public.restaurants WHERE id = '54fc4da3-ff39-42ba-b327-67fd80e27d42';

-- 3. Update Team India's restaurant slug from 'smartlink01' to 'smartlink'
UPDATE public.restaurants 
SET slug = 'smartlink', name = 'SmartLink', is_published = true
WHERE id = '738de8e0-55cf-460a-a96f-17973fc84ab5';

-- 4. Re-enable the protection trigger
ALTER TABLE public.restaurants ENABLE TRIGGER tr_validate_protect_restaurant_slug;

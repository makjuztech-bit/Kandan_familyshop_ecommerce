-- ==============================================================================
-- KANDAN FAMILY SHOP - SUPABASE DATABASE SCHEMA & INITIAL SETUP
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project and navigate to the "SQL Editor" tab on the left menu.
-- 3. Click "New query", paste all contents of this file, and click "Run".
-- ==============================================================================

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  collection TEXT NOT NULL,
  colour TEXT NOT NULL,
  fabric TEXT DEFAULT '',
  zari TEXT DEFAULT '',
  price NUMERIC NOT NULL,
  stock BOOLEAN DEFAULT true,
  hex TEXT DEFAULT '#888888',
  images JSONB DEFAULT '[]'::jsonb,
  blouse TEXT DEFAULT '',
  care TEXT DEFAULT '',
  best BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for collection filtering
CREATE INDEX IF NOT EXISTS idx_products_collection ON public.products(collection);

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  no TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT DEFAULT '',
  pincode TEXT DEFAULT '',
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  shipping NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmed',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  payment_method TEXT DEFAULT 'Cash on Delivery (COD)',
  email_status TEXT DEFAULT 'idle',
  email_error TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  at TEXT
);

-- Index for customer order search
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 3. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  verified INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  admin_response TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for product reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Products policies (allow read to all, allow modifications via anon key for demo)
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow product inserts and updates" ON public.products;
CREATE POLICY "Allow product inserts and updates" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

-- Orders policies (allow read and create for customers)
DROP POLICY IF EXISTS "Allow public read orders" ON public.orders;
CREATE POLICY "Allow public read orders" ON public.orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert and update orders" ON public.orders;
CREATE POLICY "Allow public insert and update orders" ON public.orders
  FOR ALL USING (true) WITH CHECK (true);

-- Reviews policies
DROP POLICY IF EXISTS "Allow public read reviews" ON public.reviews;
CREATE POLICY "Allow public read reviews" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert reviews" ON public.reviews;
CREATE POLICY "Allow public insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update reviews" ON public.reviews;
CREATE POLICY "Allow public update reviews" ON public.reviews
  FOR UPDATE USING (true);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
-- Enable realtime broadcasting for orders and products
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.orders, public.products, public.reviews;
COMMIT;

-- ==============================================================================
-- INITIAL SEED CATALOG (20 Silk Sarees & Attire)
-- ==============================================================================
INSERT INTO public.products (id, name, collection, colour, fabric, zari, price, stock, hex, images, blouse, care, best, is_new)
VALUES
('kfs-001', 'Royal Red Bridal Silk', 'Bridal Collection', 'Red', 'Heavy silk', 'Rich gold-tone zari body and pallu', 24999, true, '#a3182b',
 '["https://picsum.photos/seed/kfs-001-a/400/533","https://picsum.photos/seed/kfs-001-b/400/533","https://picsum.photos/seed/kfs-001-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', true, false),

('kfs-002', 'Ivory and Gold Bridal Silk', 'Bridal Collection', 'Ivory', 'Silk blend', 'Fine zari buttas, wide gold border', 22400, true, '#e9dcc0',
 '["https://picsum.photos/seed/kfs-002-a/400/533","https://picsum.photos/seed/kfs-002-b/400/533","https://picsum.photos/seed/kfs-002-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', false, true),

('kfs-003', 'Pink Muhurtham Bridal Silk', 'Bridal Collection', 'Pink', 'Heavy silk', 'Zari mango motifs, contrast border', 19800, true, '#c8567a',
 '["https://picsum.photos/seed/kfs-003-a/400/533","https://picsum.photos/seed/kfs-003-b/400/533","https://picsum.photos/seed/kfs-003-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', false, false),

('kfs-004', 'Peacock Blue Soft Silk', 'Soft Silk', 'Peacock Blue', 'Soft silk', 'Slim zari border', 6499, true, '#14697a',
 '["https://picsum.photos/seed/kfs-004-a/400/533","https://picsum.photos/seed/kfs-004-b/400/533","https://picsum.photos/seed/kfs-004-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', true, false),

('kfs-005', 'Lavender Soft Silk Butta', 'Soft Silk', 'Purple', 'Soft silk', 'Small zari buttas', 5799, true, '#5b2a76',
 '["https://picsum.photos/seed/kfs-005-a/400/533","https://picsum.photos/seed/kfs-005-b/400/533","https://picsum.photos/seed/kfs-005-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', true, false),

('kfs-006', 'Rose Soft Silk Stripe', 'Soft Silk', 'Pink', 'Soft silk', 'Zari stripes on pallu', 4999, true, '#c8567a',
 '["https://picsum.photos/seed/kfs-006-a/400/533","https://picsum.photos/seed/kfs-006-b/400/533","https://picsum.photos/seed/kfs-006-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every bench to protect zari.', false, false),

('kfs-007', 'Teal Soft Silk Jacquard', 'Soft Silk', 'Teal', 'Soft silk', 'Jacquard border with zari accents', 7250, false, '#1b7a78',
 '["https://picsum.photos/seed/kfs-007-a/400/533","https://picsum.photos/seed/kfs-007-b/400/533","https://picsum.photos/seed/kfs-007-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', true, false),

('kfs-008', 'Classic White Linen Shirt', 'Shirts', 'White', 'Cotton linen', 'Tailored fit with subtle self-texture', 3999, true, '#f8f4eb',
 '["https://picsum.photos/seed/kfs-008-a/400/533","https://picsum.photos/seed/kfs-008-b/400/533","https://picsum.photos/seed/kfs-008-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, true),

('kfs-009', 'Navy Check Shirt', 'Shirts', 'Navy', 'Cotton blend', 'Checked weave, button placket', 4299, true, '#1e2a5a',
 '["https://picsum.photos/seed/kfs-009-a/400/533","https://picsum.photos/seed/kfs-009-b/400/533","https://picsum.photos/seed/kfs-009-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, false),

('kfs-010', 'Pearl Pink Satin Top', 'Tops', 'Pink', 'Satin', 'Soft draped neckline with clean finish', 3499, true, '#c8567a',
 '["https://picsum.photos/seed/kfs-010-a/400/533","https://picsum.photos/seed/kfs-010-b/400/533","https://picsum.photos/seed/kfs-010-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', false, true),

('kfs-011', 'Ivory Ruffle Top', 'Tops', 'Ivory', 'Cotton', 'Light ruffle sleeves and fit', 2999, true, '#e9dcc0',
 '["https://picsum.photos/seed/kfs-011-a/400/533","https://picsum.photos/seed/kfs-011-b/400/533","https://picsum.photos/seed/kfs-011-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', true, false),

('kfs-012', 'Charcoal Wide-Leg Pants', 'Pants', 'Charcoal', 'Cotton twill', 'Relaxed pleated waist and straight fall', 4599, true, '#3b3b3b',
 '["https://picsum.photos/seed/kfs-012-a/400/533","https://picsum.photos/seed/kfs-012-b/400/533","https://picsum.photos/seed/kfs-012-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, false),

('kfs-013', 'Khaki Straight Pants', 'Pants', 'Khaki', 'Cotton twill', 'Easy movement and clean front creases', 4299, true, '#8f8a5b',
 '["https://picsum.photos/seed/kfs-013-a/400/533","https://picsum.photos/seed/kfs-013-b/400/533","https://picsum.photos/seed/kfs-013-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, true),

('kfs-014', 'Plum Satin Evening Top', 'Tops', 'Purple', 'Satin', 'Minimal shimmer finish with elegant drape', 3899, true, '#5b2a76',
 '["https://picsum.photos/seed/kfs-014-a/400/533","https://picsum.photos/seed/kfs-014-b/400/533","https://picsum.photos/seed/kfs-014-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', true, false),

('kfs-015', 'Soft Pink Printed Shirt', 'Shirts', 'Pink', 'Cotton', 'Tiny floral print and relaxed tailoring', 4499, true, '#c8567a',
 '["https://picsum.photos/seed/kfs-015-a/400/533","https://picsum.photos/seed/kfs-015-b/400/533","https://picsum.photos/seed/kfs-015-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, true),

('kfs-016', 'Burgundy Casual Shirt', 'Shirts', 'Maroon', 'Cotton', 'Structured collar, easy fit for daily wear', 4199, true, '#6b1523',
 '["https://picsum.photos/seed/kfs-016-a/400/533","https://picsum.photos/seed/kfs-016-b/400/533","https://picsum.photos/seed/kfs-016-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, true),

('kfs-017', 'Rose Gold Soft Silk Saree', 'Soft Silk', 'Gold', 'Soft silk', 'Soft sheen and subtle zari accents', 7999, true, '#b8964f',
 '["https://picsum.photos/seed/kfs-017-a/400/533","https://picsum.photos/seed/kfs-017-b/400/533","https://picsum.photos/seed/kfs-017-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', false, false),

('kfs-018', 'Emerald Flowing Soft Silk', 'Soft Silk', 'Emerald Green', 'Soft silk', 'Fine border detail and satin touch', 6899, true, '#1f6b52',
 '["https://picsum.photos/seed/kfs-018-a/400/533","https://picsum.photos/seed/kfs-018-b/400/533","https://picsum.photos/seed/kfs-018-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.', false, false),

('kfs-019', 'Black Slim Fit Trousers', 'Pants', 'Charcoal', 'Stretch twill', 'Tailored waist with modern straight fall', 5199, true, '#3b3b3b',
 '["https://picsum.photos/seed/kfs-019-a/400/533","https://picsum.photos/seed/kfs-019-b/400/533","https://picsum.photos/seed/kfs-019-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, false),

('kfs-020', 'Stone Beige Lounge Pants', 'Pants', 'Ivory', 'Cotton blend', 'Comfort fit with soft textured finish', 3799, true, '#e9dcc0',
 '["https://picsum.photos/seed/kfs-020-a/400/533","https://picsum.photos/seed/kfs-020-b/400/533","https://picsum.photos/seed/kfs-020-c/400/533"]'::jsonb,
 'Unstitched blouse piece included (sample detail — confirm in store).', 'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.', false, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  collection = EXCLUDED.collection,
  colour = EXCLUDED.colour,
  fabric = EXCLUDED.fabric,
  zari = EXCLUDED.zari,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  hex = EXCLUDED.hex,
  images = EXCLUDED.images,
  blouse = EXCLUDED.blouse,
  care = EXCLUDED.care,
  best = EXCLUDED.best,
  is_new = EXCLUDED.is_new;

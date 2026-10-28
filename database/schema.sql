-- ══════════════════════════════════════════════════════════════════════════════
--  مشروع نظام إدارة وحجز تصاريح الروضة الشريفة (Enterprise Cloud Edition)
--  التوقيت الرسمي للنظام: Asia/Riyadh
--
--  ★★★ الملف الموحد الوحيد لقاعدة البيانات ★★★
--  فيه كل الجداول + كل التعديلات المرحّلة (أعمدة الذكر/الأنثى، السداد،
--  الريال تايم مع الحذف، تقفيل RLS، تريجر ربط مستخدمي Auth، إصلاح دور admin،
--  سياسات RLS معتمدة على الدور لمنع تصعيد الصلاحيات C-2،
--  تريگر Auth آمن لا يأخذ الدور من بيانات المستخدم ولا ينقل ملكية حساب C-4).
--
--  ✓ آمن للتشغيل على القاعدة الحية في أي وقت (idempotent — تكراره لا يضر)
--  ✓ يصلح لإنشاء قاعدة جديدة كاملة من الصفر
--  التشغيل: Supabase Dashboard → SQL Editor → New query → لصق الملف كاملاً → Run
--
--  آخر تحديث: 2026-10-04 (C-2 RLS بالدور + C-4 تريگر استيلاء الحساب وسلسلة التحديث)
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. الامتدادات والتوقيت
-- ══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

SET timezone = 'Asia/Riyadh';

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. الأنواع (ENUMs)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
    CREATE TYPE account_type_enum AS ENUM ('wallet', 'bank');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE account_provider_enum AS ENUM (
        'vodafone_cash', 'orange_cash', 'etisalat_cash', 'instapay',
        'al_rajhi', 'al_ahli', 'riyad_bank', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'sales', 'inventory', 'accountant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE permit_status_enum AS ENUM ('available', 'locked', 'assigned', 'returned', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ضمان إضافة حالة 'expired' للتصاريح المنتهية إذا كان النوع موجوداً مسبقاً
ALTER TYPE permit_status_enum ADD VALUE IF NOT EXISTS 'expired';

DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('instant', 'scheduled');
    CREATE TYPE order_status_enum AS ENUM ('confirmed', 'searching', 'unconfirmed', 'cancelled');
    CREATE TYPE delivery_status_enum AS ENUM ('sent', 'waiting', 'not_sent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sms_status_enum AS ENUM ('unmatched', 'matched', 'ignored');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. الجداول
-- ══════════════════════════════════════════════════════════════════════════════

-- 3.1 بيانات الشركة والإعدادات (company_settings)
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name_ar VARCHAR(255) NOT NULL DEFAULT 'مؤسسة روضة الهدى لتنظيم وتصاريح الزيارة',
    company_name_en VARCHAR(255) DEFAULT 'Rawdah Al-Huda Permits & Bookings',
    address TEXT DEFAULT 'المدينة المنورة - المنطقة المركزية الشمالية',
    primary_phone VARCHAR(50) DEFAULT '+966501234567',
    secondary_phone VARCHAR(50) DEFAULT '+201012345678',
    whatsapp_number VARCHAR(50) DEFAULT '+966501234567',
    email VARCHAR(255) DEFAULT 'info@rawdah-system.com',
    logo_url TEXT,
    tax_number VARCHAR(100),
    commercial_registry VARCHAR(100),
    invoice_footer_note TEXT DEFAULT 'تقبل الله زيارتكم وطاعتكم ونسألكم صالح الدعاء في الروضة الشريفة',
    currency VARCHAR(10) DEFAULT 'SAR',
    default_permit_price DECIMAL(10, 2) DEFAULT 150.00,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.2 الحسابات البنكية والمحافظ (financial_accounts)
CREATE TABLE IF NOT EXISTS financial_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type account_type_enum NOT NULL DEFAULT 'wallet',
    provider account_provider_enum NOT NULL DEFAULT 'vodafone_cash',
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    account_holder_name VARCHAR(255),
    iban VARCHAR(100),
    branch_name VARCHAR(150),
    current_balance DECIMAL(12, 2) DEFAULT 0.00,
    currency VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.3 الموظفون والأدوار (profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE,
    phone_number VARCHAR(50),
    whatsapp_number VARCHAR(50),
    role user_role_enum NOT NULL DEFAULT 'sales',
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    custom_permissions JSONB DEFAULT '{
        "view": true,
        "create": true,
        "edit": true,
        "delete": false,
        "reports": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.4 العملاء (customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(50) NOT NULL,
    additional_phone VARCHAR(50),
    nickname VARCHAR(100),
    notes TEXT,
    total_orders_count INT DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0.00,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.5 مخزون التصاريح (permits) — نظام الـ 24 ساعة (00:00-23:00) وفترات 00/20/40
CREATE TABLE IF NOT EXISTS permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permit_code VARCHAR(100) UNIQUE,
    slot_date DATE NOT NULL,
    slot_hour INT NOT NULL CHECK (slot_hour >= 0 AND slot_hour <= 23),
    slot_minute INT NOT NULL CHECK (slot_minute IN (0, 20, 40)),
    slot_formatted VARCHAR(10) GENERATED ALWAYS AS (
        LPAD(slot_hour::TEXT, 2, '0') || ':' || LPAD(slot_minute::TEXT, 2, '0')
    ) STORED,
    image_url TEXT NOT NULL,
    status permit_status_enum NOT NULL DEFAULT 'available',

    assigned_to_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_customer_name VARCHAR(255),   -- نسخ نصية لتجنب JOIN
    assigned_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_by_user_name VARCHAR(255),
    assigned_at TIMESTAMPTZ,

    locked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,

    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

CREATE INDEX IF NOT EXISTS idx_permits_slot ON permits(slot_date, slot_hour, slot_minute, status);

-- 3.6 الطلبات (sales_orders)
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number BIGSERIAL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    customer_whatsapp VARCHAR(50),
    permits_count INT NOT NULL DEFAULT 1,
    permits_count_male INT,               -- تقسيم العدد ذكر/أنثى (NULL = غير محدد)
    permits_count_female INT,
    target_date DATE NOT NULL,
    target_time VARCHAR(20) NOT NULL,
    order_type order_type_enum NOT NULL DEFAULT 'instant',
    order_status order_status_enum NOT NULL DEFAULT 'searching',
    delivery_status delivery_status_enum NOT NULL DEFAULT 'not_sent',

    unit_price DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    remaining_amount DECIMAL(10, 2) DEFAULT 0.00,  -- يُحسب في الكود عند كل تحديث
    currency VARCHAR(10) DEFAULT 'SAR',
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    payments JSONB DEFAULT '[]'::jsonb,           -- سجل السدادات (يدوي + مطابقات SMS)
    last_reminder_at TIMESTAMPTZ,                 -- آخر تذكير سداد أُرسل للعميل

    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.7 وصل التصاريح بالطلبات (order_permits)
CREATE TABLE IF NOT EXISTS order_permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    permit_id UUID NOT NULL REFERENCES permits(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.8 رسائل الدفع SMS (sms_messages)
CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender VARCHAR(100) NOT NULL,
    raw_body TEXT NOT NULL,
    parsed_amount DECIMAL(12, 2),
    parsed_reference_id VARCHAR(100),
    parsed_account_number VARCHAR(100),
    parsed_provider account_provider_enum,

    status sms_status_enum NOT NULL DEFAULT 'unmatched',
    matched_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    matched_order_number BIGINT,
    matched_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,

    received_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- 3.9 سجل العمليات والتدقيق (audit_logs) — إلحاق فقط
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. ترحيل الأعمدة للقواعد القديمة (لا تأثير على قاعدة كاملة — أعمدة موجودة تُتخطى)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS permits_count_male INT,
  ADD COLUMN IF NOT EXISTS permits_count_female INT,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

ALTER TABLE financial_accounts
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

COMMENT ON COLUMN sales_orders.payments IS 'سجل السدادات المسجلة على الطلب (يدوي + مطابقات SMS) — تحصيل كل موظف آخر اليوم';
COMMENT ON COLUMN sales_orders.last_reminder_at IS 'آخر مرة أُرسل فيها تذكير سداد للعميل';

-- قيود عدم السالبية للتقسيم ذكر/أنثى (حماية استرشادية)
DO $$
BEGIN
    BEGIN
        ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_gender_split_not_negative
            CHECK (permits_count_male IS NULL OR permits_count_male >= 0);
    EXCEPTION WHEN duplicate_object THEN null;
    END;
    BEGIN
        ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_gender_split_not_negative_2
            CHECK (permits_count_female IS NULL OR permits_count_female >= 0);
    EXCEPTION WHEN duplicate_object THEN null;
    END;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. تريجر ربط مستخدمي Supabase Auth بالبروفايلات (النسخة الآمنة — إصلاح C-4)
--
--    ثغرتان تم إغلاقهما:
--      أ) الدور كان يُؤخذ من user_metadata (بيانات يتحكم فيها المستخدم نفسه) →
--         أي تسجيل ذاتي بدور role: 'super_admin' كان يصنع مديراً عاماً من لا شيء.
--         الآن: كل موظف جديد يدخل 'sales' حصراً، والمدير يرقّيه من لوحة الموظفين.
--      ب) ON CONFLICT (username) DO UPDATE SET id = EXCLUDED.id كان ينقل ملكية
--         صف البروفايل لأي شخص يسجل باسم موظف موجود (admin/sales/sara...) →
--         استيلاء كامل على الحساب. والتريگر SECURITY DEFINER فيتجاوز RLS،
--         لذا سياسات C-2 وحدها لا تحمي منه إطلاقاً.
--         الآن: لا يُنقل id إلا بشروط أربعة مجتمعة (القسم 5أ أدناه).
--         ولم نعد نفرض is_active = TRUE حتى لا يُعاد تفعيل حساب موقوف تلقائياً.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_orphan   UUID;
BEGIN
  v_username := COALESCE(new.raw_user_meta_data->>'username',
                         split_part(new.email, '@', 1));

  -- ══ القسم 5أ: شروط إعادة الربط الأربعة (إصلاح C-6) ══
  --   1) بريد مؤكد: التطبيق لا ينشئ مستخدمين Auth إطلاقاً، فالمدير وحده
  --      من يفعل ذلك يدوياً من لوحة Supabase (حيث يكون البريد مؤكداً).
  --      بدونه يستطيع أي شخص — متى فُتح باب التسجيل الذاتي — أن يسجّل
  --      باسم موظف موجود ويستولي على صفّه كاملاً.
  --   2) الصف يتيم: غير مرتبط بأي مستخدم Auth حيّ (الموظف الحقيقي لا يملكه).
  --   3) الصف فعّال: لا نربط حساباً موقوفاً بقادم جديد ولا نُعيد تفعيله.
  --   4) اسم المستخدم مطابق تماماً.
  IF new.email_confirmed_at IS NOT NULL THEN
      SELECT p.id INTO v_orphan
      FROM public.profiles p
      WHERE p.username = v_username
        AND COALESCE(p.is_active, TRUE)
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
      LIMIT 1;
  END IF;

  IF v_orphan IS NOT NULL THEN
      UPDATE public.profiles
      SET id         = new.id,
          role       = 'sales'::user_role_enum,
          updated_at = now()
      WHERE id = v_orphan;

      -- أثر تدقيقي دائم: أي نقل ملكية صف بروفايل يجب أن يظهر في السجل
      INSERT INTO public.audit_logs (user_id, action_type, entity_name, entity_id, details)
      VALUES (
          new.id,
          'REBIND_PROFILE',
          'profiles',
          new.id,
          jsonb_build_object(
              'orphan_profile_id', v_orphan,
              'username', v_username,
              'note', 'ربط بروفايل يتيم بمستخدم Auth مؤكد البريد'
          )
      );
  ELSE
      -- لا يوجد صف يتيم: إما أن اسم المستخدم محجوز لموظف حقيقي (وهنا يفشل
      -- الإدراج عمداً ويبقى القادم الجديد بلا بروفايل → staff_role() ترجع NULL
      -- فلا يرى ولا يعدّل شيئاً، أي يفشل مغلقاً)، أو أن الاسم حر فيُنشأ صف جديد.
      INSERT INTO public.profiles (
        id, full_name, username, phone_number, whatsapp_number, role, is_active
      )
      VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        v_username,
        COALESCE(new.raw_user_meta_data->>'phone_number', ''),
        COALESCE(new.raw_user_meta_data->>'whatsapp_number', ''),
        'sales'::user_role_enum,
        TRUE
      )
      ON CONFLICT (username) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- إصلاح بيانات حية: التريجر القديم سجّل admin بدور 'sales' (لوحة التحكم لا ترسل دوراً)
UPDATE public.profiles SET role = 'super_admin' WHERE username = 'admin';

-- ══════════════════════════════════════════════════════════════════════════════
-- 5ب. سلسلة التحديث لمراجع profiles (إصلاح C-4)
--    تبديل id صف البروفايل (الربط أو إعادة الربط في التريگر أعلاه) لو حصل
--    يجب أن تتبعه المراجع تلقائياً، وإلا فشل التريگر بقيد المفتاح الأجنبي
--    ولم يُنشأ البروفايل. نُضيف ON UPDATE CASCADE لكل مرجع (مع الحفاظ على
--    ON DELETE SET NULL الحالي).
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r RECORD;
    conname TEXT;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('customers',        'created_by'),
        ('permits',          'assigned_by_user_id'),
        ('permits',          'locked_by_user_id'),
        ('permits',          'created_by'),
        ('sms_messages',     'matched_by_user_id'),
        ('audit_logs',       'user_id')
    ) AS t(tbl, col)
    LOOP
        conname := r.tbl || '_' || r.col || '_fkey';
        BEGIN
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, conname);
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) '
                'REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE',
                r.tbl, conname, r.col
            );
            RAISE NOTICE '✅ % → ON UPDATE CASCADE', conname;
        EXCEPTION WHEN OTHERS THEN
            -- القيد غير موجود أو مسمّى باسم مختلف — لا شيء يكسر التشغيل
            RAISE NOTICE '⏭️ % skipped: %', conname, SQLERRM;
        END;
    END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. الأمان — RLS معتمد على الدور (إصلاح C-2: منع تصعيد الصلاحيات)
--
--    المبدأ: لا شيء للزائر المجهول (anon) إلا استثناءان معلنان أدناه.
--    الموظفون المصادَقون يقرؤون كل الجداول (المزامنة والعمل) لكن:
--      • دور/صلاحيات/حالة الموظف    → للمدير العام فقط (لا أحد يرفع نفسه)
--      • إعدادات المؤسسة            → للمدير العام فقط
--      • إنشاء/تعديل بيانات الحسابات → للمدير العام والمحاسب فقط
--      • حذف بيانات الأعمال         → للمدير العام فقط
--      • أرصدة الخزائن              → الكل يُحدّث الرصيد فقط (تسجيل السداد)
--      • سجل التدقيق                → إلحاق وقراءة فقط (لا تعديل ولا حذف أبداً)
--
--    ملاحظة PostgREST: سياسات الأمر نفسه تُدمج بـ OR، لذلك لا نستخدم FOR ALL
--    أبداً مع سياسة DELETE مقيدة — FOR ALL يلغي التقييد بـ OR.
-- ══════════════════════════════════════════════════════════════════════════════

-- 6.1 دالة مساعدة: دور الموظف الحالي من profiles
--     SECURITY DEFINER (تُنفّذ بصلاحية المالك فتتجاوز RLS) لتفادي
--     الاستدعاء الدائري مع سياسات profiles نفسها. auth.uid() يحدد المتصل.
--
--     إصلاح H-10: الموظف الموقوف يرجع NULL وليس دوره. كل سياسات الكتابة
--     أدناه تقارن staff_role() بقيمة، و NULL لا يساوي شيئاً أبداً — فيسقط
--     الإيقاف فوراً على كل الصلاحيات بدل أن يبقى تجميلياً في الواجهة فقط
--     (جلسة JWT الموقوف تظل سالحة حتى انتهائها، وهذا ما يوقفها فعلياً).
--     COALESCE لأن العمود nullable والعميل يعامل NULL كنشط.
CREATE OR REPLACE FUNCTION public.staff_role()
RETURNS user_role_enum
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
      AND COALESCE(is_active, TRUE);
$$;

-- 6.2 تفعيل RLS على كل الجداول + حذف كل سياسة قائمة (أي اسم كان) — آمن للتكرار
DO $$
DECLARE t TEXT;
        p RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'company_settings','financial_accounts','profiles','customers','permits',
        'sales_orders','order_permits','sms_messages','audit_logs'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        FOR p IN SELECT policyname FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- 6.2.1 منح صلاحيات Data API الصريحة (متوافقة مع سياسة Supabase الجديدة 30 أكتوبر)
-- يضمن وصول supabase-js و PostgREST للجداول دائماً دون خطأ permission denied
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- إعطاء صلاحية الإدراج لـ anon لتمكين تسجيل العملاء الذاتي عبر رابط الواتساب (?register=true)
GRANT INSERT ON public.customers TO anon;
GRANT INSERT ON public.audit_logs TO anon;

-- منح الصلاحيات تلقائياً لأي جداول جديدة تُنشأ مستقبلاً في public
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- 6.3 ملء الصلاحيات الفارغة ثم قفل العمود NOT NULL — حتى يعمل فحص
--     تجميد الصلاحيات في سياسة التحديث الذاتي بشكل موثوق (NULL ≠ الافتراضي)
UPDATE public.profiles
SET custom_permissions = '{"view": true, "create": true, "edit": true, "delete": false, "reports": false}'::jsonb
WHERE custom_permissions IS NULL;

DO $$ BEGIN
    ALTER TABLE public.profiles ALTER COLUMN custom_permissions SET NOT NULL;
EXCEPTION WHEN NOT_NULL_VIOLATION THEN
    -- صفوف لا تزال NULL (الحالة النادرة التي لم يغطها UPDATE أعلاه)
    RAISE NOTICE 'skipped NOT NULL on profiles.custom_permissions';
END $$;

ALTER TABLE public.profiles ALTER COLUMN custom_permissions
    SET DEFAULT '{"view": true, "create": true, "edit": true, "delete": false, "reports": false}'::jsonb;

-- 6.4 إعدادات المؤسسة — قراءة للجميع، كتابة للمدير العام فقط
CREATE POLICY "staff read company_settings"   ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage company_settings" ON company_settings FOR ALL    TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum)
    WITH CHECK (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.5 الموظفون — قراءة للجميع؛ الإدراج والحذف للمدير فقط؛
--     التعديل: إما مدير (أي حقل) أو ذاتي (صفه فقط مع تجميد الدور والصلاحيات والحالة)
CREATE POLICY "staff read profiles" ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin insert profiles" ON profiles FOR INSERT TO authenticated
    WITH CHECK (public.staff_role() = 'super_admin'::user_role_enum);

CREATE POLICY "admin delete profiles" ON profiles FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

CREATE POLICY "admin update profiles" ON profiles FOR UPDATE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum)
    WITH CHECK (public.staff_role() = 'super_admin'::user_role_enum);

CREATE POLICY "self update profiles" ON profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6.6 الحسابات المالية — قراءة للجميع؛ إنشاء وتعديل وحذف مقيّد؛ والرصيد
--     لا يُكتب مباشرة من أي دور: تعديل الرصيد يمر عبر rpc_adjust_balance
--     (القسم 7.4) لكل الموظفين، فيبقى تسجيل السداد متاحاً من أي جهاز
--     دون أن يستطيع أحد ضبط الرصيد على رقم اختياري بلا سبب ولا سجل.
CREATE POLICY "staff read financial_accounts" ON financial_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance insert financial_accounts" ON financial_accounts FOR INSERT TO authenticated
    WITH CHECK (public.staff_role() = 'super_admin'::user_role_enum
                OR public.staff_role() = 'accountant'::user_role_enum);

CREATE POLICY "finance update financial_accounts" ON financial_accounts FOR UPDATE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum
           OR public.staff_role() = 'accountant'::user_role_enum)
    WITH CHECK (public.staff_role() = 'super_admin'::user_role_enum
                OR public.staff_role() = 'accountant'::user_role_enum);

-- باقي الموظفين: لا إنشاء ولا حذف ولا تعديل مباشر لصفوف الحسابات.
--
-- إصلاح H-11: أُلغيت سياسة "staff update account balance" القديمة. كانت
-- USING (true) مع مقارنة كل الأعمدة عدا current_balance — أي أن أي موظف
-- مبيعات كان يستطيع ضبط رصيد أي خزينة على أي رقم يختاره، فتتزور كل
-- التقارير المالية دون أثر. تسجيل السداد الآن يمر حصراً عبر
-- rpc_adjust_balance (القسم 7.4): يأخذ فرقاً لا قيمة مطلقة (فلا تضيع
-- تحديثات متزامنة) ويُلزم بسبب ويكتب سطراً في سجل التدقيق غير القابل
-- للمحو. الدالة SECURITY DEFINER فتتجاوز RLS ولا تحتاج سياسة UPDATE.

CREATE POLICY "admin delete financial_accounts" ON financial_accounts FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.7 بيانات الأعمال — قراءة وكتابة تشغيلية للجميع، الحذف للمدير العام فقط
-- 6.7.1 العملاء
CREATE POLICY "staff read customers"   ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete customers" ON customers FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.7.2 التصاريح
CREATE POLICY "staff read permits"   ON permits FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert permits" ON permits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update permits" ON permits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete permits" ON permits FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.7.3 الطلبات
CREATE POLICY "staff read sales_orders"   ON sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert sales_orders" ON sales_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update sales_orders" ON sales_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete sales_orders" ON sales_orders FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.7.4 وصل التصاريح بالطلبات — جدول ربط تشغيلي (حذف الصفوف جزء من
--      إرجاع التصريح وإلغاء الطلب) لذا يبقى متاحاً لكل الموظفين
CREATE POLICY "staff read order_permits"   ON order_permits FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert order_permits" ON order_permits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update order_permits" ON order_permits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff delete order_permits" ON order_permits FOR DELETE TO authenticated USING (true);

-- 6.7.5 رسائل السداد — قراءة ومطابقة للجميع، الحذف للمدير فقط
CREATE POLICY "staff read sms_messages"   ON sms_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert sms_messages" ON sms_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update sms_messages" ON sms_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete sms_messages" ON sms_messages FOR DELETE TO authenticated
    USING (public.staff_role() = 'super_admin'::user_role_enum);

-- 6.8 سجل التدقيق — إلحاق وقراءة فقط (لا UPDATE ولا DELETE إطلاقاً)
--     ملاحظة: زر "مسح البيانات" في الإعدادات لن يستطيع حذف سجل التدقيق
--     من السحابة بعد الآن (بال design) — السجل غير قابل للتعديل نهائياً.
CREATE POLICY "staff insert audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff read audit_logs"   ON audit_logs FOR SELECT TO authenticated USING (true);

-- 6.9 استثناءات الزائر المجهول (anon) — اثنتان فقط:
--  أ) تسجيل العميل الذاتي عبر الرابط العام: إدراج فقط، بلا قراءة ولا تعديل
CREATE POLICY "anon self-register customers" ON customers
    FOR INSERT TO anon
    WITH CHECK (full_name IS NOT NULL AND created_by IS NULL);

--  ب) هاتف الشركة (Android SMS Forwarder) يرسل رسائل السداد بمفتاح anon —
--     بدون هذه السياسة تتوقف إشعارات السداد الفورية نهائياً
CREATE POLICY "anon insert sms_messages" ON sms_messages
    FOR INSERT TO anon
    WITH CHECK (raw_body IS NOT NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. الدوال الذرّية (منع الحجز المزدوج + تعديل الأرصدة بأثر مسجَّل)
--
--    إصلاح C-5 الحرج: هذه الدوال SECURITY DEFINER أي أنها تتجاوز RLS
--    بالكامل. وكانت منشورة بلا أي REVOKE — وPostgres يمنح EXECUTE لـ PUBLIC
--    افتراضياً — فأي زائر يملك مفتاح anon العام (وهو عام بالتصميم وموجود
--    داخل حزمة JS) كان يستطيع استدعاءها وتزوير السداد ونسبته لأي موظف.
--    أُغلقت الثغرة بثلاثة إجراءات مجتمعة:
--      أ) حذف p_user_id من كل التواقيع: هوية المنفّذ تُقرأ من auth.uid()
--         وحدها، فلا تُنسب عملية لموظف لم ينفذها.
--      ب) حارس staff_role() IS NULL في أول كل دالة: يرفض المجهول والموقوف
--         ومن لا يملك بروفايل مربوطاً — وهو الحارس الوحيد الفعّال هنا لأن
--         RLS معطَّل داخل الدالة بالتعريف.
--      ج) القسم 7.5 يسحب EXECUTE من PUBLIC و anon صراحةً.
--    وأُضيفت SET search_path = public لكل دالة: بدونها يستطيع مهاجم يملك
--    صلاحية إنشاء كائنات في مخطط آخر أن يظلّل الجداول والدوال المستعملة.
--
--    ملاحظة توقيع: تغيير قائمة المعاملات لا يستبدل الدالة القائمة بل ينشئ
--    حملاً زائداً بجانبها، لذا DROP صريح لكل توقيع قديم قبل الإنشاء —
--    وإلا بقيت النسخة المثقوبة قابلة للاستدعاء على القاعدة الحية.
-- ══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_claim_permit(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.rpc_return_permit(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_return_permit(UUID, UUID);

-- 7.1 سحب وتخصيص تصريح لعميل
CREATE OR REPLACE FUNCTION public.rpc_claim_permit(
    p_permit_id UUID,
    p_customer_id UUID,
    p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permit permits%ROWTYPE;
    v_uid UUID := auth.uid();
BEGIN
    IF public.staff_role() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'جلسة غير صالحة أو حساب موقوف');
    END IF;

    SELECT * INTO v_permit FROM permits WHERE id = p_permit_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'التصريح غير موجود');
    END IF;

    IF v_permit.status != 'available' THEN
        RETURN jsonb_build_object('success', false, 'message', 'عذراً، هذا التصريح تم حجزه بالفعل من موظف آخر لحظياً');
    END IF;

    UPDATE permits
    SET
        status = 'assigned',
        assigned_to_customer_id = p_customer_id,
        assigned_by_user_id = v_uid,
        assigned_at = (NOW() AT TIME ZONE 'Asia/Riyadh'),
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_permit_id;

    IF p_order_id IS NOT NULL THEN
        INSERT INTO order_permits (order_id, permit_id)
        VALUES (p_order_id, p_permit_id)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, details)
    VALUES (
        v_uid,
        'CLAIM_PERMIT',
        'permits',
        p_permit_id,
        jsonb_build_object('customer_id', p_customer_id, 'order_id', p_order_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'تم تخصيص التصريح بنجاح', 'permit_id', p_permit_id);
END;
$$;

-- 7.2 إرجاع التصريح للمخزون
CREATE OR REPLACE FUNCTION public.rpc_return_permit(
    p_permit_id UUID,
    p_reason TEXT DEFAULT 'إلغاء من قبل العميل'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permit permits%ROWTYPE;
    v_uid UUID := auth.uid();
BEGIN
    IF public.staff_role() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'جلسة غير صالحة أو حساب موقوف');
    END IF;

    SELECT * INTO v_permit FROM permits WHERE id = p_permit_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'التصريح غير موجود');
    END IF;

    IF v_permit.status != 'assigned' AND v_permit.status != 'locked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'التصريح ليس في حالة مخصصة ليتم إرجاعه');
    END IF;

    DELETE FROM order_permits WHERE permit_id = p_permit_id;

    UPDATE permits
    SET
        status = 'available',
        assigned_to_customer_id = NULL,
        assigned_by_user_id = NULL,
        assigned_at = NULL,
        locked_by_user_id = NULL,
        locked_at = NULL,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_permit_id;

    INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, details)
    VALUES (
        v_uid,
        'RETURN_PERMIT',
        'permits',
        p_permit_id,
        jsonb_build_object('reason', p_reason, 'previous_customer_id', v_permit.assigned_to_customer_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'تم إرجاع التصريح للمخزون بنجاح');
END;
$$;

-- 7.3 حذف rpc_match_sms_payment نهائياً
--     كانت SECURITY DEFINER بلا حارس وبلا REVOKE: أي زائر بمفتاح anon يُدرج
--     رسالة sms_messages وهمية (السياسة العامة تسمح بالإدراج) ثم يستدعي
--     الدالة فيقلب أي طلب إلى confirmed ويضخّم paid_amount وينسب العملية
--     لموظف بريء عبر p_user_id. وكانت كذلك تحمل خلل IF NOT FOUND بعد
--     SELECT INTO مزدوج (FOUND تعكس آخر استعلام فقط). لا يستدعيها التطبيق
--     إطلاقاً — المطابقة تتم في dataService.ts بمنطق أغنى — فحذفها هو
--     الإصلاح: سطح هجوم بلا أي مقابل وظيفي.
DROP FUNCTION IF EXISTS public.rpc_match_sms_payment(UUID, UUID, UUID);

-- 7.4 تعديل رصيد خزينة بفرق مُسجَّل (بديل سياسة الرصيد الملغاة)
--     يأخذ فرقاً (delta) لا قيمة مطلقة: قراءتان متزامنتان للرصيد لا
--     تمحو إحداهما الأخرى، وهي الثغرة التي كانت تقع حين تُفتح نافذة
--     التعديل ثم تصل دفعة قبل الحفظ. ويُلزم بسبب غير فارغ ويكتب سطراً في
--     سجل التدقيق الملحق-فقط، فيصير كل تغيير رصيد قابلاً للتتبع.
CREATE OR REPLACE FUNCTION public.rpc_adjust_balance(
    p_account_id UUID,
    p_delta NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account financial_accounts%ROWTYPE;
    v_uid UUID := auth.uid();
    v_new NUMERIC;
BEGIN
    IF public.staff_role() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'جلسة غير صالحة أو حساب موقوف');
    END IF;

    IF p_delta IS NULL OR p_delta = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'لا يوجد فرق في الرصيد لتسجيله');
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'سبب تعديل الرصيد إلزامي لأغراض التدقيق');
    END IF;

    SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الحساب المالي غير موجود');
    END IF;

    v_new := COALESCE(v_account.current_balance, 0) + p_delta;

    UPDATE financial_accounts
    SET current_balance = v_new,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_account_id;

    INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, details)
    VALUES (
        v_uid,
        'ADJUST_BALANCE',
        'financial_accounts',
        p_account_id,
        jsonb_build_object(
            'delta', p_delta,
            'balance_before', COALESCE(v_account.current_balance, 0),
            'balance_after', v_new,
            'currency', v_account.currency,
            'reason', trim(p_reason)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تحديث الرصيد',
        'balance', v_new,
        'account_id', p_account_id
    );
END;
$$;

-- 7.5 سحب صلاحية التنفيذ من المجهول والعموم
--     EXECUTE ممنوح لـ PUBLIC افتراضياً في Postgres، فبدون هذا Block تبقى
--     كل دوال SECURITY DEFINER أعلاه قابلة للاستدعاء بمفتاح anon العام.
--     تُسحب من الجميع ثم تُمنح للمصادَقين فقط، والدالتان الداخليتان
--     (handle_new_user تريگر، staff_role تستدعيها السياسات) تُستثنيان صراحةً.
--
--     استثناء دوال الامتدادات إلزامي: أعمدة DEFAULT uuid_generate_v4() /
--     gen_random_uuid() تُقيَّم بصلاحية المستخدم المُدرِج، فسحب EXECUTE عنها
--     يكسر كل إدراج في القاعدة. (في مشاريع Supabase الحديثة تعيش هذه الدوال
--     في مخطط extensions أصلاً، لكن المشاريع القديمة قد تحملها في public.)
DO $$
DECLARE
    f RECORD;
    v_granted TEXT[] := ARRAY['rpc_claim_permit', 'rpc_return_permit', 'rpc_adjust_balance'];
BEGIN
    FOR f IN SELECT p.oid::regprocedure AS sig, p.proname
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND NOT EXISTS (
                    SELECT 1 FROM pg_depend d
                     WHERE d.objid = p.oid AND d.deptype = 'e'
                )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
            f.sig
        );

        IF f.proname = ANY (v_granted) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
            RAISE NOTICE '✅ EXECUTE → authenticated only: %', f.sig;
        ELSIF f.proname = 'staff_role' THEN
            -- تُستدعى داخل سياسات RLS بصفة المتصل (authenticated)
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
            RAISE NOTICE '✅ EXECUTE → authenticated, service_role: %', f.sig;
        ELSIF f.proname = 'handle_new_user' THEN
            -- تريگر على auth.users: ينفّذه supabase_auth_admin ومالك المخطط
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO postgres, supabase_auth_admin', f.sig);
            RAISE NOTICE '✅ EXECUTE → postgres, supabase_auth_admin: %', f.sig;
        ELSE
            RAISE NOTICE '🔒 EXECUTE revoked from all roles: %', f.sig;
        END IF;
    END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. الريال تايم — البث اللحظي لكل الجداول (يشمل أحداث الحذف)
-- ══════════════════════════════════════════════════════════════════════════════
-- Supabase ينشئ publication الافتراضي بـ publish='insert, update' فقط —
-- بدون السطر التالي أحداث الحذف لا تصل الأجهزة أبداً.
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'company_settings','financial_accounts','profiles','customers','permits',
        'sales_orders','order_permits','sms_messages','audit_logs'
    ]
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
            RAISE NOTICE '✅ Added % to supabase_realtime', tbl;
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE '⏭️ % already in supabase_realtime — skipped', tbl;
        END;
    END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. فحص بعد التشغيل (اختياري — شغّل كل سطر لوحده لو حابب تتأكد)
-- ══════════════════════════════════════════════════════════════════════════════
-- دور admin لازم يكون super_admin:
-- SELECT username, role FROM public.profiles ORDER BY created_at;
--
-- كل عمود custom_permissions معبأ (لا NULL):
-- SELECT count(*) FROM public.profiles WHERE custom_permissions IS NULL;
--
-- دالة الدور ترجع دور المتصل:
-- SELECT public.staff_role();
--   ⚠️ في محرر SQL تعيد NULL لأن الجلسة لا تحوي مستخدماً مسجلاً (طبيعي جداً).
--   لرؤية قيمة حقيقية لنفس الجلسة:
-- SET LOCAL request.jwt.claims.sub = '<uuid-الموظف>'; SELECT public.staff_role();
--
-- السياسات على كل جدول (العدد المتوقع لكل جدول):
--   company_settings 2 | financial_accounts 4 | profiles 5 | customers 5
--   permits 4 | sales_orders 4 | order_permits 4 | sms_messages 5 | audit_logs 2
--   ⚠️ financial_accounts كان 5 قبل إصلاح H-11 — حُذفت سياسة
--     "staff update account balance" وصار تعديل الرصيد عبر rpc_adjust_balance فقط.
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' ORDER BY tablename, cmd;
--
-- محاكاة اختبار تصعيد الصلاحيات: موظف مبيعات يحاول رفع نفسه super_admin.
-- SET LOCAL role='authenticated' يجعل RLS مطبّقاً على الجلسة (المحرر يدخل
-- كـ postgres فيتخطى RLS، لذا بدون هذا السطر ينجح التحديث ونظن خطأً أن
-- الإصلاح لم يعمل)، و request.jwt.claims.sub يجعل auth.uid() ترجع الموظف:
-- BEGIN;
-- SET LOCAL role = 'authenticated';
-- SET LOCAL request.jwt.claims.sub = '<uuid-موظف-المبيعات>';
-- UPDATE public.profiles SET role='super_admin' WHERE id='<uuid-موظف-المبيعات>';
--   ← يجب أن ترفض بـ ERROR: new row violates row-level security policy
-- UPDATE public.profiles SET phone_number='+201000000000' WHERE id='<uuid-موظف-المبيعات>';
--   ← يجب أن تنجح (تعديل ذاتي لبياناته بدون لمس الدور)
-- ROLLBACK;
--
-- فحص C-4: مصدر تريگر handle_new_user — لازم خالي من user_metadata->>'role'
-- ومن 'ON CONFLICT (username) DO UPDATE'، ولازم يحوي حارس email_confirmed_at:
-- SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
--
-- فحص C-4: كل مراجع profiles عليها ON UPDATE CASCADE (confupdtype = 'c'):
-- SELECT conname, conrelid::regclass AS tbl, confupdtype
--   FROM pg_constraint
--   WHERE confrelid = 'public.profiles'::regclass
--   ORDER BY conrelid::regclass::text, conname;
--
-- فحص C-5: دوال RPC كلها SECURITY DEFINER ومضبوط عليها search_path:
-- SELECT proname, prosecdef, proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND proname LIKE 'rpc\_%'
--  ORDER BY proname;
--   ← المتوقع 3 دوال فقط (rpc_adjust_balance, rpc_claim_permit, rpc_return_permit)
--     وprosecdef = true لكل منها، وproconfig يحوي search_path=public.
--     لو ظهرت rpc_match_sms_payment فالحذف لم يُطبَّق.
--
-- فحص C-5: صلاحيات التنفيذ — لازم anon و PUBLIC محجوبين عن كل دوال RPC:
-- SELECT p.proname,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can,
--        has_function_privilege('public',        p.oid, 'EXECUTE') AS public_can
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--  ORDER BY p.proname;
--   ← لدوال rpc_*: anon_can = false و public_can = false و auth_can = true.
--
-- فحص H-10: موظف موقوف لازم staff_role() ترجع له NULL (فلا يرى ولا يعدّل شيئاً).
-- استبدل الـ UUID بمعرّف موظف is_active = false:
-- BEGIN;
-- SET LOCAL role = 'authenticated';
-- SET LOCAL request.jwt.claims.sub = '<uuid-موظف-موقوف>';
-- SELECT public.staff_role();   ← يجب أن ترجع NULL
-- ROLLBACK;
--
-- فحص H-11: لا توجد أي سياسة UPDATE على financial_accounts تسمح بكتابة الرصيد مباشرة:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
--  WHERE schemaname='public' AND tablename='financial_accounts';
--   ← سياسة UPDATE الوحيدة المتبقية هي "finance update financial_accounts"
--     (مشروطة بدور accountant/super_admin) — والرصيد يُعدَّل عبر rpc_adjust_balance.
--
-- كل الجداول مسجلة في الريال تايم مع الحذف:
-- SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. دليل التشغيل: إنشاء مستخدمين وتسجيل الدخول (يدوي من لوحة Supabase)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ▌لماذا يدوي؟
--   التطبيق لا يحمل مفتاح service_role (ووجوده في تطبيق عميل = تسريب كامل
--   للقاعدة)، ولا توجد Edge Function لإنشاء المستخدمين. لذلك المدير وحده هو
--   من ينشئ مستخدم Auth لكل موظف من لوحة Supabase.
--
-- ▌قاعدة تسمية البريد (إلزامية — التطبيق يعتمد عليها)
--   شاشة الدخول تحوّل اسم المستخدم إلى بريد بالصيغة:
--       <username>@rawdah.app
--   أي موظف username عنده «sara» يجب أن يكون مستخدم Auth الخاص به بالبريد
--   «sara@rawdah.app» حرفياً. لو أُنشئ ببريد آخر فلن يستطيع الدخول أبداً،
--   ولو أُنشئ ببريد حقيقي (gmail مثلاً) فسيكتب الموظف ذلك البريد في خانة
--   اسم المستخدم وسيدخل — لكنه حينها يملك صف بروفايل مختلفاً.
--
-- ▌خطوات إنشاء مستخدم موظف جديد
--   1) لوحة Supabase → Authentication → Users → «Add user» →
--      «Create new user».
--   2) Email: <username>@rawdah.app    (نفس username المذكور في بطاقة الموظف)
--   3) Password: مؤقت قوي، ويُسلَّم للموظف ليغيّره من «تغيير كلمة المرور».
--   4) ✅ علّم «Auto Confirm User» — **إلزامي**. التريجر handle_new_user
--      لا يربط البروفايل اليتيم إلا إذا كان email_confirmed_at غير NULL،
--      فبدون هذه العلامة يُنشأ مستخدم Auth بلا بروفايل مربوط → الدخول يرفض.
--   5) بعد الإنشاء، خذ UUID المستخدم وانفّذ الربط إن لم يحصل تلقائياً
--      (البروفايل اليتيم موجود أصلاً لأن الموظف أُنشئ من داخل التطبيق):
--
--        UPDATE public.profiles
--           SET id = '<uuid-مستخدم-Auth>'
--         WHERE username = '<username>'
--           AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = profiles.id);
--
--      ثم سجّل الحركة:
--        INSERT INTO public.audit_logs (user_id, action_type, entity_name, entity_id, details)
--        VALUES ('<uuid-مستخدم-Auth>', 'MANUAL_BIND_PROFILE', 'profiles',
--                '<uuid-مستخدم-Auth>', '{"username":"<username>","by":"admin-dashboard"}'::jsonb);
--
-- ▌إعدادات Authentication الواجب ضبطها مرة واحدة
--   Authentication → Providers → Email:
--     • «Enable Sign Ups» = **OFF**. التطبيق لا يحتاج تسجيل ذاتي إطلاقاً؛
--       إبقاؤها مفتوحة يعني أن أي شخص على الإنترنت يملك مفتاح anon (وهو
--       عام بحكم وجوده في حزمة JS) يستطيع إنشاء مستخدم Auth.
--     • «Confirm email» = OFF (لا بريد حقيقياً للاستلام).
--   Authentication → URL Configuration: اترك Site URL كما هو — لا يُستخدم
--     تدفق استعادة كلمة المرور عبر البريد؛ التغيير يتم من داخل التطبيق.
--
-- ▌معرفة الموظفين غير المربوطين (لا يستطيعون الدخول)
-- SELECT p.username, p.full_name, p.role, p.is_active
--   FROM public.profiles p
--  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
--  ORDER BY p.role, p.username;
--
-- ▌معرفة المستخدمين المربوطين بشكل سليم
-- SELECT p.username, p.role, u.email, u.email_confirmed_at IS NOT NULL AS confirmed
--   FROM public.profiles p
--   JOIN auth.users u ON u.id = p.id
--  ORDER BY p.role, p.username;
--
-- ▌أثر التدقيق المالي (كل تعديل رصيد عبر rpc_adjust_balance مسجَّل)
-- SELECT a.created_at, p.username, a.details->>'reason' AS reason,
--        (a.details->>'delta')::numeric AS delta,
--        (a.details->>'balance_before')::numeric AS before_bal,
--        (a.details->>'balance_after')::numeric AS after_bal
--   FROM public.audit_logs a
--   LEFT JOIN public.profiles p ON p.id = a.user_id
--  WHERE a.action_type = 'ADJUST_BALANCE'
--  ORDER BY a.created_at DESC;

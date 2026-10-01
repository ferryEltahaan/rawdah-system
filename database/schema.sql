-- ══════════════════════════════════════════════════════════════════════════════
--  مشروع نظام إدارة وحجز تصاريح الروضة الشريفة (Enterprise Cloud Edition)
--  التوقيت الرسمي للنظام: Asia/Riyadh
--
--  ★★★ الملف الموحد الوحيد لقاعدة البيانات ★★★
--  فيه كل الجداول + كل التعديلات المرحّلة (أعمدة الذكر/الأنثى، السداد،
--  الريال تايم مع الحذف، تقفيل RLS، تريجر ربط مستخدمي Auth، إصلاح دور admin).
--
--  ✓ آمن للتشغيل على القاعدة الحية في أي وقت (idempotent — تكراره لا يضر)
--  ✓ يصلح لإنشاء قاعدة جديدة كاملة من الصفر
--  التشغيل: Supabase Dashboard → SQL Editor → New query → لصق الملف كاملاً → Run
--
--  آخر تحديث: 2026-10-02 (توحيد كل ملفات الهجرة المتفرقة في هذا الملف)
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
    CREATE TYPE permit_status_enum AS ENUM ('available', 'locked', 'assigned', 'returned', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
-- 5. تريجر ربط مستخدمي Supabase Auth بالبروفايلات (النسخة النهائية)
--    عند إنشاء مستخدم Auth جديد باسم موجود مسبقاً في profiles: يربط اليوزر
--    الجديد بالسطر القائم ويحتفظ باسمه ودوره الحقيقيين بدل الفشل على التضارب.
--    ملاحظة: تبديل id يفترض أن جداول البيانات لا تشير للبروفايل القديم بعد —
--    مناسب لمرحلة التسليم (جداول الطلبات/العملاء فارغة عند أول ربط).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, username, phone_number, whatsapp_number, role, is_active
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    COALESCE(new.raw_user_meta_data->>'whatsapp_number', ''),
    COALESCE((new.raw_user_meta_data->>'role')::user_role_enum, 'sales'),
    TRUE
  )
  ON CONFLICT (username) DO UPDATE
  SET id = EXCLUDED.id,
      is_active = TRUE,
      updated_at = now();

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
-- 6. الأمان — تفعيل RLS على كل الجداول وإعادة بناء السياسات بصيغة موحدة
--    المبدأ: لا قراءة ولا كتابة لأي حد مجهول (anon) إلا استثناءً معلناً أدناه.
--    حذف كل سياسة قائمة ثم إنشاء القائمة القياسية — التكرار لا يضاعف سياسات.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE company_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_permits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'company_settings','financial_accounts','profiles','customers','permits',
        'sales_orders','order_permits','sms_messages','audit_logs'
    ]
    LOOP
        -- تشغيل RLS نفسه (بدونه كل السياسات مبتدرة)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        -- حذف كل السياسات القائمة (بغض النظر عن الاسم)
        FOR p IN SELECT policyname FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- قراءة/كتابة للمستخدمين المصادقين فقط على كل الجداول
CREATE POLICY "authenticated read company_settings"   ON company_settings   FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write company_settings"  ON company_settings   FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read financial_accounts" ON financial_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write financial_accounts" ON financial_accounts FOR ALL   TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read profiles"           ON profiles           FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write profiles"          ON profiles           FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read customers"          ON customers          FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write customers"         ON customers          FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read permits"            ON permits            FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write permits"           ON permits            FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read sales_orders"       ON sales_orders       FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write sales_orders"      ON sales_orders       FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read order_permits"      ON order_permits      FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write order_permits"     ON order_permits      FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read sms_messages"       ON sms_messages       FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write sms_messages"      ON sms_messages       FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- استثناء 1: تسجيل العملاء الذاتي من الرابط العام — إدراج فقط بلا قراءة ولا تعديل
CREATE POLICY "anon self-register customers" ON customers
  FOR INSERT TO anon
  WITH CHECK (full_name IS NOT NULL AND created_by IS NULL);

-- استثناء 2: هاتف الشركة (Android SMS Forwarder) يرسل الرسائل بمفتاح anon —
-- بدون هذه السياسة تتوقف إشعارات السداد الفورية نهائياً
CREATE POLICY "anon insert sms_messages" ON sms_messages
  FOR INSERT TO anon
  WITH CHECK (raw_body IS NOT NULL);

-- سجل التدقيق: إلحاق وقراءة فقط — لا UPDATE ولا DELETE إطلاقاً
CREATE POLICY "authenticated insert audit_logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated read audit_logs" ON audit_logs
  FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. دوال القفل المتزامن (منع الحجز المزدوج)
-- ══════════════════════════════════════════════════════════════════════════════

-- 7.1 سحب وتخصيص تصريح لعميل
CREATE OR REPLACE FUNCTION rpc_claim_permit(
    p_permit_id UUID,
    p_customer_id UUID,
    p_order_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_permit permits%ROWTYPE;
BEGIN
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
        assigned_by_user_id = p_user_id,
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
        p_user_id,
        'CLAIM_PERMIT',
        'permits',
        p_permit_id,
        jsonb_build_object('customer_id', p_customer_id, 'order_id', p_order_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'تم تخصيص التصريح بنجاح', 'permit_id', p_permit_id);
END;
$$;

-- 7.2 إرجاع التصريح للمخزون
CREATE OR REPLACE FUNCTION rpc_return_permit(
    p_permit_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT 'إلغاء من قبل العميل'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_permit permits%ROWTYPE;
BEGIN
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
        p_user_id,
        'RETURN_PERMIT',
        'permits',
        p_permit_id,
        jsonb_build_object('reason', p_reason, 'previous_customer_id', v_permit.assigned_to_customer_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'تم إرجاع التصريح للمخزون بنجاح');
END;
$$;

-- 7.3 مطابقة سداد SMS وتحديث الطلب ذرياً
CREATE OR REPLACE FUNCTION rpc_match_sms_payment(
    p_sms_id UUID,
    p_order_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sms sms_messages%ROWTYPE;
    v_order sales_orders%ROWTYPE;
BEGIN
    SELECT * INTO v_sms FROM sms_messages WHERE id = p_sms_id FOR UPDATE;
    SELECT * INTO v_order FROM sales_orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'بيانات الرسالة أو الطلب غير موجودة');
    END IF;

    IF v_sms.status = 'matched' THEN
        RETURN jsonb_build_object('success', false, 'message', 'هذه الرسالة تم احتسابها ومطابقتها مسبقاً');
    END IF;

    UPDATE sms_messages
    SET
        status = 'matched',
        matched_order_id = p_order_id,
        matched_by_user_id = p_user_id,
        matched_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_sms_id;

    UPDATE sales_orders
    SET
        paid_amount = paid_amount + COALESCE(v_sms.parsed_amount, 0),
        order_status = CASE
            WHEN (paid_amount + COALESCE(v_sms.parsed_amount, 0)) >= total_amount THEN 'confirmed'
            ELSE order_status
        END,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_order_id;

    INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, details)
    VALUES (
        p_user_id,
        'MATCH_SMS',
        'sales_orders',
        p_order_id,
        jsonb_build_object('sms_id', p_sms_id, 'amount', v_sms.parsed_amount)
    );

    RETURN jsonb_build_object('success', true, 'message', 'تم تأكيد السداد وربط الدفعة بنجاح');
END;
$$;

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
-- السياسات القياسية على كل جدول (لازم profiles = 2، audit_logs = 2، إلخ):
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
--
-- كل الجداول مسجلة في الريال تايم مع الحذف:
-- SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';

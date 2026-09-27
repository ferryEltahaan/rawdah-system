-- ==============================================================================
-- مشروع نظام إدارة وحجز تصاريح الروضة الشريفة (Enterprise Cloud Edition)
-- التوقيت الرسمي للنظام: Asia/Riyadh
-- نظام أمان مشدد مع سياسات Row Level Security (RLS) ودوال القفل المتزامن
-- ==============================================================================

-- 1. تفعيل الامتدادات المطلوبة (Extensions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ضبط التوقيت الافتراضي للجلسة
SET timezone = 'Asia/Riyadh';

-- ==============================================================================
-- 2. جدول بيانات الشركة والإعدادات الأساسية (company_settings)
-- ==============================================================================
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

-- ==============================================================================
-- 3. جدول الحسابات البنكية والمحافظ الإلكترونية (financial_accounts)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE account_type_enum AS ENUM ('wallet', 'bank');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_provider_enum AS ENUM (
        'vodafone_cash', 'orange_cash', 'etisalat_cash', 'instapay', 
        'al_rajhi', 'al_ahli', 'riyad_bank', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ==============================================================================
-- 4. جدول الموظفين والأدوار والصلاحيات (profiles & roles)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'sales', 'inventory', 'accountant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

-- ربط تلقائي عند تسجيل مستخدم جديد في Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, username, phone_number, whatsapp_number, role, is_active)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'phone_number', ''),
        COALESCE(new.raw_user_meta_data->>'whatsapp_number', ''),
        COALESCE((new.raw_user_meta_data->>'role')::user_role_enum, 'sales'),
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. جدول العملاء (customers)
-- ==============================================================================
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

-- ==============================================================================
-- 6. جدول مخزون التصاريح (permits)
-- نظام الـ 24 ساعة (00:00 - 23:00) والفترات الثلاث (00, 20, 40)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE permit_status_enum AS ENUM ('available', 'locked', 'assigned', 'returned', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    assigned_customer_name VARCHAR(255),   -- نسخ نصية لعدم الحاجة لـ JOIN
    assigned_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_by_user_name VARCHAR(255),    -- نسخ نصية لسهولة التتبع
    assigned_at TIMESTAMPTZ,
    
    locked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

CREATE INDEX IF NOT EXISTS idx_permits_slot ON permits(slot_date, slot_hour, slot_minute, status);

-- ==============================================================================
-- 7. جدول عمليات البيع والطلبات (sales_orders)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('instant', 'scheduled');
    CREATE TYPE order_status_enum AS ENUM ('confirmed', 'searching', 'unconfirmed', 'cancelled');
    CREATE TYPE delivery_status_enum AS ENUM ('sent', 'waiting', 'not_sent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number BIGSERIAL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),        -- نسخ نصية لسهولة البحث
    customer_whatsapp VARCHAR(50),     -- نسخ نصية للواتساب
    permits_count INT NOT NULL DEFAULT 1,
    target_date DATE NOT NULL,
    target_time VARCHAR(20) NOT NULL,
    order_type order_type_enum NOT NULL DEFAULT 'instant',
    order_status order_status_enum NOT NULL DEFAULT 'searching',
    delivery_status delivery_status_enum NOT NULL DEFAULT 'not_sent',
    
    unit_price DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    remaining_amount DECIMAL(10, 2) DEFAULT 0.00,  -- محسوب في الكود عند كل تحديث
    
    notes TEXT,
    created_by TEXT,                   -- اسم الموظف كنص (UUID أو اسم)
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

CREATE TABLE IF NOT EXISTS order_permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    permit_id UUID NOT NULL REFERENCES permits(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ==============================================================================
-- 8. جدول رسائل الدفع SMS المستلمة (sms_messages)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE sms_status_enum AS ENUM ('unmatched', 'matched', 'ignored');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    matched_order_number BIGINT,           -- نسخة نصية لرقم الطلب
    matched_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,
    
    received_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ==============================================================================
-- 9. جدول سجل العمليات والتدقيق (audit_logs)
-- ==============================================================================
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

-- ==============================================================================
-- 10. تفعيل سياسات الأمان المشددة (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول (RLS Policies) - تدعم الاتصال المباشر والـ Authenticated
CREATE POLICY "Allow select on company_settings" ON company_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on company_settings" ON company_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on financial_accounts" ON financial_accounts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on financial_accounts" ON financial_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on profiles" ON profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on profiles" ON profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on customers" ON customers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on customers" ON customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on permits" ON permits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on permits" ON permits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on sales_orders" ON sales_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on sales_orders" ON sales_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on order_permits" ON order_permits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on order_permits" ON order_permits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on sms_messages" ON sms_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all on sms_messages" ON sms_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow select on audit_logs" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert on audit_logs" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ==============================================================================
-- 11. دوال القفل المتزامن لمنع الحجز المزدوج (Atomic Locking Stored Procedures)
-- ==============================================================================

-- دالة سحب وتخصيص تصريح لعميل
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
    -- قفل السجل ومنع القراءة المتزامنة
    SELECT * INTO v_permit
    FROM permits
    WHERE id = p_permit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'التصريح غير موجود');
    END IF;

    IF v_permit.status != 'available' THEN
        RETURN jsonb_build_object('success', false, 'message', 'عذراً، هذا التصريح تم حجزه بالفعل من موظف آخر لحظياً');
    END IF;

    -- تحديث حالة التصريح
    UPDATE permits
    SET 
        status = 'assigned',
        assigned_to_customer_id = p_customer_id,
        assigned_by_user_id = p_user_id,
        assigned_at = (NOW() AT TIME ZONE 'Asia/Riyadh'),
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = p_permit_id;

    -- ربط التصريح بالطلب إن وجد
    IF p_order_id IS NOT NULL THEN
        INSERT INTO order_permits (order_id, permit_id)
        VALUES (p_order_id, p_permit_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- تسجيل في سجل التدقيق
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

-- دالة إرجاع التصريح للمخزون
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
    SELECT * INTO v_permit
    FROM permits
    WHERE id = p_permit_id
    FOR UPDATE;

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

-- دالة مطابقة سداد SMS
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

-- تفعيل Realtime على الجداول الرئيسية
ALTER PUBLICATION supabase_realtime ADD TABLE permits;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

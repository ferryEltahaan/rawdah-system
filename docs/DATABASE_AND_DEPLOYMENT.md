# 🗄️ مرجع قاعدة البيانات والنشر السحابي (Database Schema & Deployment Guide)

> **الدليل الكامل لهيكل قاعدة بيانات PostgreSQL في Supabase وخطوات النشر والصيانة على Vercel.**

---

## 1. جداول قاعدة البيانات (PostgreSQL Database Schema)

### 1. جدول `profiles` (حسابات الموظفين والمستخدمين)
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR NOT NULL,
  username VARCHAR UNIQUE NOT NULL,
  phone_number VARCHAR,
  whatsapp_number VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'sales', -- 'super_admin' | 'sales' | 'inventory' | 'accountant'
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  custom_permissions JSONB NOT NULL DEFAULT '{"view":true,"create":true,"edit":true,"delete":false,"reports":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. جدول `customers` (بيانات العملاء والمعتمرين)
```sql
CREATE TABLE public.customers (
  id VARCHAR PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  whatsapp_number VARCHAR NOT NULL,
  additional_phone VARCHAR,
  nickname VARCHAR,
  notes TEXT,
  total_orders_count INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. جدول `permits` (مخزون التصاريح اليومي)
```sql
CREATE TABLE public.permits (
  id VARCHAR PRIMARY KEY,
  permit_code VARCHAR NOT NULL,
  slot_date DATE NOT NULL,
  slot_hour INTEGER NOT NULL,        -- 0 إلى 23
  slot_minute INTEGER NOT NULL,      -- 0, 20, 40
  slot_formatted VARCHAR NOT NULL,   -- e.g. "14:20"
  image_url TEXT,
  status VARCHAR NOT NULL DEFAULT 'available', -- 'available' | 'assigned' | 'locked'
  assigned_to_customer_id VARCHAR REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_customer_name VARCHAR,
  assigned_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by_user_name VARCHAR,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4. جدول `sales_orders` (طلبات المبيعات)
```sql
CREATE TABLE public.sales_orders (
  id VARCHAR PRIMARY KEY,
  order_number BIGSERIAL UNIQUE,
  customer_id VARCHAR NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name VARCHAR NOT NULL,
  customer_whatsapp VARCHAR NOT NULL,
  permits_count INTEGER NOT NULL DEFAULT 1,
  permits_count_male INTEGER DEFAULT 0,
  permits_count_female INTEGER DEFAULT 0,
  target_date DATE NOT NULL,
  target_time VARCHAR NOT NULL,
  order_type VARCHAR NOT NULL DEFAULT 'instant', -- 'instant' | 'scheduled'
  order_status VARCHAR NOT NULL DEFAULT 'searching', -- 'searching' | 'confirmed' | 'cancelled'
  delivery_status VARCHAR NOT NULL DEFAULT 'not_sent', -- 'not_sent' | 'sent'
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  remaining_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR NOT NULL DEFAULT 'SAR', -- 'SAR' | 'EGP'
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  payments JSONB DEFAULT '[]'::jsonb,
  last_reminder_at TIMESTAMPTZ,
  notes TEXT,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5. جدول `order_permits` (جدول الوسيط لربط التصاريح بالطلبات)
```sql
CREATE TABLE public.order_permits (
  order_id VARCHAR NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  permit_id VARCHAR NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  PRIMARY KEY (order_id, permit_id)
);
```

### 6. جدول `sms_messages` (رسائل الـ SMS وسجل السداد)
```sql
CREATE TABLE public.sms_messages (
  id VARCHAR PRIMARY KEY,
  sender VARCHAR NOT NULL,
  raw_body TEXT NOT NULL,
  parsed_amount NUMERIC(10, 2),
  parsed_reference_id VARCHAR,
  parsed_account_number VARCHAR,
  parsed_provider VARCHAR, -- 'vodafone_cash' | 'instapay' | 'orange_cash' | 'etisalat_cash' | 'al_rajhi' | 'al_ahli' | 'riyad_bank'
  status VARCHAR NOT NULL DEFAULT 'unmatched', -- 'unmatched' | 'matched' | 'ignored'
  matched_order_id VARCHAR REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  matched_order_number BIGINT,
  matched_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 7. جدول `financial_accounts` (الحسابات البنكية والمحافظ)
```sql
CREATE TABLE public.financial_accounts (
  id VARCHAR PRIMARY KEY,
  type VARCHAR NOT NULL DEFAULT 'wallet', -- 'bank' | 'wallet'
  provider VARCHAR NOT NULL,
  account_name VARCHAR NOT NULL,
  account_number VARCHAR NOT NULL,
  account_holder_name VARCHAR,
  iban VARCHAR,
  current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8. جدول `company_settings` (بيانات المؤسسة والشعار)
```sql
CREATE TABLE public.company_settings (
  id VARCHAR PRIMARY KEY,
  company_name_ar VARCHAR NOT NULL,
  company_name_en VARCHAR,
  phone_number VARCHAR NOT NULL,
  whatsapp_number VARCHAR NOT NULL,
  address VARCHAR,
  email VARCHAR,
  logo_url TEXT,
  tax_number VARCHAR,
  commercial_registry VARCHAR,
  invoice_footer_note TEXT,
  currency VARCHAR NOT NULL DEFAULT 'SAR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 9. جدول `audit_logs` (سجل التدقيق وتوثيق العمليات)
```sql
CREATE TABLE public.audit_logs (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  action_type VARCHAR NOT NULL,
  entity_name VARCHAR NOT NULL,
  entity_id VARCHAR NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 2. سياسات الأمان والحماية (Row Level Security - RLS)

تفعيل RLS مع السماح بالقراءة والكتابة للمستخدمين المصرح لهم:
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسة عامة للوصول المصرح (Authenticated & Anon Fallback)
CREATE POLICY "Allow read for authenticated users" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.customers FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.permits FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.sales_orders FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.order_permits FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.sms_messages FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.financial_accounts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.company_settings FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.audit_logs FOR ALL USING (true);
```

---

## 3. خطوات النشر على Vercel (Vercel Deployment Guide)

1. **المجلد الجاهز للنشر**:
   - استخدم محتويات المجلد `C:\Users\ferry\Desktop\rawdah_deployment_ready`.
2. **إعدادات المشروع في Vercel**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. **متغيرات البيئة (Environment Variables)**:
   - `VITE_SUPABASE_URL`: `https://aeuavoqhrhzsxblrddlc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `VITE_SMS_WEBHOOK_SECRET`: `rawdah_sec_2026`

---

## 4. استعلامات الصيانة والتنظيف (Maintenance SQL)

### تصفير البيانات للبدء من جديد (Clean Reset):
```sql
TRUNCATE TABLE public.order_permits CASCADE;
TRUNCATE TABLE public.sales_orders CASCADE;
TRUNCATE TABLE public.permits CASCADE;
TRUNCATE TABLE public.sms_messages CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.customers CASCADE;
UPDATE public.financial_accounts SET current_balance = 0.00;
```

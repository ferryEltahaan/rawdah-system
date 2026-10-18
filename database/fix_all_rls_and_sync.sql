-- ============================================================
-- حل مشكلة مزامنة العملاء والطلبات والتصاريح بين الأجهزة والموظفين
-- يسمح بالوصول الكامل لقراءة وكتابة البيانات عبر السحابة لجميع المستخدمين
-- ============================================================

-- 1. جدول العملاء (Customers)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read customers" ON public.customers;
DROP POLICY IF EXISTS "staff insert customers" ON public.customers;
DROP POLICY IF EXISTS "staff update customers" ON public.customers;
DROP POLICY IF EXISTS "admin delete customers" ON public.customers;
DROP POLICY IF EXISTS "anon self-register customers" ON public.customers;
DROP POLICY IF EXISTS "allow all customers" ON public.customers;
CREATE POLICY "allow all customers" ON public.customers 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 2. جدول التصاريح (Permits)
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read permits" ON public.permits;
DROP POLICY IF EXISTS "staff insert permits" ON public.permits;
DROP POLICY IF EXISTS "staff update permits" ON public.permits;
DROP POLICY IF EXISTS "admin delete permits" ON public.permits;
DROP POLICY IF EXISTS "allow all permits" ON public.permits;
CREATE POLICY "allow all permits" ON public.permits 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 3. جدول طلبات المبيعات (Sales Orders)
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "staff insert sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "staff update sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "admin delete sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "allow all sales_orders" ON public.sales_orders;
CREATE POLICY "allow all sales_orders" ON public.sales_orders 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 4. جدول ربط التصاريح بالطلبات (Order Permits)
ALTER TABLE public.order_permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read order_permits" ON public.order_permits;
DROP POLICY IF EXISTS "staff insert order_permits" ON public.order_permits;
DROP POLICY IF EXISTS "staff update order_permits" ON public.order_permits;
DROP POLICY IF EXISTS "staff delete order_permits" ON public.order_permits;
DROP POLICY IF EXISTS "allow all order_permits" ON public.order_permits;
CREATE POLICY "allow all order_permits" ON public.order_permits 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 5. جدول ملفات الموظفين (Profiles)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow read profiles for login" ON public.profiles;
DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "self update profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow all profiles" ON public.profiles;
CREATE POLICY "allow all profiles" ON public.profiles 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 6. جدول الحسابات المالية (Financial Accounts)
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read financial_accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "finance insert financial_accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "finance update financial_accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "admin delete financial_accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "allow all financial_accounts" ON public.financial_accounts;
CREATE POLICY "allow all financial_accounts" ON public.financial_accounts 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 7. جدول رسائل SMS البنكية (SMS Messages)
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "staff insert sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "staff update sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "admin delete sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "anon insert sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "allow all sms_messages" ON public.sms_messages;
CREATE POLICY "allow all sms_messages" ON public.sms_messages 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 8. جدول سجل العمليات (Audit Logs)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "staff insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "allow all audit_logs" ON public.audit_logs;
CREATE POLICY "allow all audit_logs" ON public.audit_logs 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

-- 9. جدول إعدادات المنشأة (Company Settings)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "admin manage company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "allow all company_settings" ON public.company_settings;
CREATE POLICY "allow all company_settings" ON public.company_settings 
  FOR ALL TO anon, authenticated 
  USING (true) WITH CHECK (true);

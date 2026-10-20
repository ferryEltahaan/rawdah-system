-- إضافة حقل سعر التصريح الواحد الافتراضي إلى جدول إعدادات المؤسسة
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS default_permit_price DECIMAL(10, 2) DEFAULT 150.00;

-- تحديث السعر الحالي إذا كانت القيمة فارغة
UPDATE public.company_settings 
SET default_permit_price = 150.00 
WHERE default_permit_price IS NULL;

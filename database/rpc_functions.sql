-- ══════════════════════════════════════════════════════════════════════════════
--  دوال السيرفر السحابية (Stored Procedures / RPC Functions)
--  مشروع نظام إدارة وحجز تصاريح الروضة الشريفة
--
--  ★★★ مهم جداً ★★★
--  هذه الدوال يجب تشغيلها في Supabase SQL Editor مرة واحدة عند إنشاء المشروع
--  أو عند إعادة بناء قاعدة البيانات من الصفر.
--  بدونها: تسجيل الدخول السحابي وإضافة الموظفين لن تعمل.
--
--  التشغيل: Supabase Dashboard → SQL Editor → New query → لصق الملف كاملاً → Run
--  آمن للتشغيل أكثر من مرة (idempotent — CREATE OR REPLACE)
--
--  آخر تحديث: 2026-10-18
-- ══════════════════════════════════════════════════════════════════════════════

-- تأكد إن امتداد pgcrypto موجود (للتشفير)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. دالة المصادقة السحابية الفورية (rpc_authenticate_user)
--    الغرض: التحقق من اسم المستخدم وكلمة المرور بأمان على السيرفر
--    المستدعي: LoginScreen.tsx عند محاولة تسجيل الدخول
-- ══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS rpc_authenticate_user(TEXT, TEXT);
CREATE OR REPLACE FUNCTION rpc_authenticate_user(
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile       RECORD;
    v_clean_user    TEXT;
    v_email_domain  TEXT := 'rawdah.app';
BEGIN
    -- تنظيف اسم المستخدم وإزالة domain لو موجود
    v_clean_user := lower(trim(p_username));
    v_clean_user := regexp_replace(v_clean_user, '@rawdah\.app$', '');
    v_clean_user := regexp_replace(v_clean_user, '^@+|@+$', '');

    -- البحث عن الموظف بالاسم المختصر أو البريد الكامل أو الاسم الكامل
    SELECT *
    INTO v_profile
    FROM profiles
    WHERE
        is_active = true
        AND (
            lower(trim(username)) = v_clean_user
            OR lower(trim(username)) = v_clean_user || '@' || v_email_domain
            OR lower(trim(username)) = p_username
            OR lower(trim(full_name)) = v_clean_user
        )
    LIMIT 1;

    -- الموظف غير موجود
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'user_not_found'
        );
    END IF;

    -- الحساب موقوف
    IF v_profile.is_active = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'user_inactive'
        );
    END IF;

    -- التحقق من كلمة المرور: يدعم bcrypt (crypt) و SHA-256 (digest)
    IF v_profile.password_hash IS NULL
       OR v_profile.password_hash = ''
       OR NOT (
           crypt(p_password, v_profile.password_hash) = v_profile.password_hash
           OR encode(digest(p_password, 'sha256'), 'hex') = lower(v_profile.password_hash)
       )
    THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'wrong_password'
        );
    END IF;

    -- نجاح — إرجاع بيانات الموظف (بدون كلمة المرور)
    RETURN jsonb_build_object(
        'success', true,
        'profile', jsonb_build_object(
            'id',                v_profile.id,
            'fullName',          v_profile.full_name,
            'username',          v_profile.username,
            'role',              v_profile.role,
            'phoneNumber',       v_profile.phone_number,
            'whatsappNumber',    v_profile.whatsapp_number,
            'isActive',          v_profile.is_active,
            'avatarUrl',         v_profile.avatar_url,
            'customPermissions', v_profile.custom_permissions,
            'createdAt',         v_profile.created_at
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'server_error',
        'detail', SQLERRM
    );
END;
$$;

-- منح صلاحية التنفيذ
GRANT EXECUTE ON FUNCTION rpc_authenticate_user(TEXT, TEXT) TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. دالة حفظ وتحديث الموظفين (rpc_save_staff_user)
--    الغرض: إضافة أو تحديث موظف وتشفير كلمة المرور مباشرة على السيرفر
--    المستدعي: EmployeesAndRolesView.tsx عند حفظ بيانات موظف
-- ══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS rpc_save_staff_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS rpc_save_staff_user;
CREATE OR REPLACE FUNCTION rpc_save_staff_user(
    p_username      TEXT,
    p_password      TEXT,
    p_full_name     TEXT,
    p_role          TEXT,
    p_phone         TEXT DEFAULT '',
    p_whatsapp      TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_user    TEXT;
    v_email_domain  TEXT := 'rawdah.app';
    v_hashed_pass   TEXT;
    v_profile_id    UUID;
    v_existing      RECORD;
BEGIN
    -- تنظيف اسم المستخدم
    v_clean_user := lower(trim(p_username));
    v_clean_user := regexp_replace(v_clean_user, '@rawdah\.app$', '');
    v_clean_user := regexp_replace(v_clean_user, '^@+|@+$', '');

    -- تشفير كلمة المرور
    IF p_password IS NOT NULL AND p_password <> '' THEN
        v_hashed_pass := crypt(p_password, gen_salt('bf', 10));
    END IF;

    -- البحث عن موظف موجود بنفس الاسم
    SELECT * INTO v_existing
    FROM profiles
    WHERE
        lower(trim(username)) = v_clean_user
        OR lower(trim(username)) = v_clean_user || '@' || v_email_domain
    LIMIT 1;

    IF FOUND THEN
        -- تحديث الموظف الموجود
        UPDATE profiles SET
            full_name        = p_full_name,
            role             = p_role::user_role_enum,
            phone_number     = p_phone,
            whatsapp_number  = p_whatsapp,
            updated_at       = NOW(),
            password_hash    = CASE
                                 WHEN v_hashed_pass IS NOT NULL THEN v_hashed_pass
                                 ELSE password_hash  -- لا تغير الباسورد لو مش موجود في الطلب
                               END
        WHERE id = v_existing.id
        RETURNING id INTO v_profile_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'updated',
            'id', v_profile_id
        );
    ELSE
        -- إنشاء موظف جديد
        INSERT INTO profiles (
            id,
            username,
            full_name,
            role,
            phone_number,
            whatsapp_number,
            password_hash,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            uuid_generate_v4(),
            v_clean_user,
            p_full_name,
            p_role::user_role_enum,
            p_phone,
            p_whatsapp,
            v_hashed_pass,
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_profile_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'created',
            'id', v_profile_id
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'server_error',
        'detail', SQLERRM
    );
END;
$$;

-- منح صلاحية التنفيذ
GRANT EXECUTE ON FUNCTION rpc_save_staff_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. دالة التسجيل الذاتي الآمن للعميل (rpc_self_register_customer)
--    الغرض: السماح للزوار بالتسجيل عبر الرابط العام بأمان تام مع منع التكرار
-- ══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS rpc_self_register_customer(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION rpc_self_register_customer(
    p_full_name TEXT,
    p_whatsapp_number TEXT,
    p_additional_phone TEXT DEFAULT NULL,
    p_nickname TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_phone_digits TEXT;
    v_customer_id UUID;
    v_existing_notes TEXT;
    v_is_new BOOLEAN := false;
BEGIN
    v_clean_name := trim(COALESCE(p_full_name, ''));
    v_clean_phone := trim(COALESCE(p_whatsapp_number, ''));
    
    IF length(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_name', 'message', 'يرجى إدخال اسم صحيح.');
    END IF;

    IF length(v_clean_phone) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_phone', 'message', 'يرجى إدخال رقم واتساب صحيح.');
    END IF;

    -- استخراج آخر 9 أرقام للتحقق من التكرار بمرونة
    v_phone_digits := regexp_replace(v_clean_phone, '\D', '', 'g');
    IF length(v_phone_digits) >= 9 THEN
        v_phone_digits := right(v_phone_digits, 9);
    END IF;

    -- البحث عن عميل موجود بنفس الرقم
    SELECT id, notes INTO v_customer_id, v_existing_notes
    FROM public.customers
    WHERE whatsapp_number = v_clean_phone
       OR (length(v_phone_digits) >= 9 AND regexp_replace(whatsapp_number, '\D', '', 'g') LIKE '%' || v_phone_digits)
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
        -- تحديث بيانات العميل القائم دون تخريب سجلاته السابقة
        UPDATE public.customers
        SET full_name = CASE WHEN length(v_clean_name) > 0 THEN v_clean_name ELSE full_name END,
            nickname = COALESCE(nullif(trim(p_nickname), ''), nickname),
            additional_phone = COALESCE(nullif(trim(p_additional_phone), ''), additional_phone),
            notes = CASE 
                WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 
                THEN COALESCE(v_existing_notes || E'\n' || trim(p_notes), trim(p_notes))
                ELSE notes
            END,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = v_customer_id;
        v_is_new := false;
    ELSE
        -- إنشاء عميل جديد
        v_customer_id := uuid_generate_v4();
        INSERT INTO public.customers (
            id,
            full_name,
            whatsapp_number,
            additional_phone,
            nickname,
            notes,
            total_orders_count,
            total_spent,
            created_at,
            updated_at
        ) VALUES (
            v_customer_id,
            v_clean_name,
            v_clean_phone,
            nullif(trim(p_additional_phone), ''),
            nullif(trim(p_nickname), ''),
            nullif(trim(p_notes), ''),
            0,
            0,
            (NOW() AT TIME ZONE 'Asia/Riyadh'),
            (NOW() AT TIME ZONE 'Asia/Riyadh')
        );
        v_is_new := true;
    END IF;

    -- تسجيل حدث تدقيق
    INSERT INTO public.audit_logs (
        action_type,
        entity_name,
        entity_id,
        details
    ) VALUES (
        CASE WHEN v_is_new THEN 'SELF_REGISTER_CUSTOMER' ELSE 'SELF_REGISTER_UPDATE' END,
        'customers',
        v_customer_id,
        jsonb_build_object(
            'full_name', v_clean_name,
            'whatsapp_number', v_clean_phone,
            'is_new', v_is_new
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'is_new', v_is_new
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'server_error',
        'detail', SQLERRM
    );
END;
$$;

-- منح صلاحية الاستدعاء لـ anon و authenticated
GRANT EXECUTE ON FUNCTION rpc_self_register_customer(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- تحقق من التثبيت
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('rpc_authenticate_user', 'rpc_save_staff_user', 'rpc_self_register_customer')
ORDER BY routine_name;

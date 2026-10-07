@echo off
chcp 65001 > nul
title نظام إدارة وحجز تصاريح الروضة الشريفة
echo ========================================================
echo        تشغيل نظام حجز وإدارة تصاريح الروضة الشريفة
echo ========================================================
echo.
echo جاري فحص بيئة التشغيل وفتح النظام...
echo.

where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo تم العثور على Node.js / NPM. جاري تشغيل سيرفر التطوير...
    start http://localhost:5173/
    npm run dev
    goto end
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo جاري تشغيل السيرفر عبر Python على المنفذ 5173...
    start http://localhost:5173/
    py -m http.server 5173 --directory dist
    goto end
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo جاري تشغيل السيرفر عبر Python على المنفذ 5173...
    start http://localhost:5173/
    python -m http.server 5173 --directory dist
    goto end
)

echo [تنبيه] لم يتم العثور على Node.js أو Python في النظام.
echo يرجى فتح الرابط يدوياً في المتصفح إذا كان السيرفر يعمل:
echo http://localhost:5173/
start http://localhost:5173/

:end
pause


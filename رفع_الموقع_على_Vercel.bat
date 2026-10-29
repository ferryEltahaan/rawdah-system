@echo off
chcp 65001 >nul
title رفع موقع مملكة السكر على Vercel
color 0D
echo ===================================================
echo     جاري رفع براند مملكة السكر على Vercel...
echo ===================================================
echo.
cd /d "c:\Users\ferry\Desktop\qoder\sugar_kingdom_deploy"
call npx vercel --prod --yes
echo.
echo ===================================================
echo     تم الرفع بنجاح! انسخ الرابط الذي ظهر بالأعلى.
echo ===================================================
pause

@echo off
title Push Updates to GitHub
color 0A
echo ===================================================
echo Pushing updates to GitHub and Vercel...
echo ===================================================
echo.
cd /d "C:\Users\dell\Desktop\qoder"
"C:\Program Files\Git\cmd\git.exe" push origin main
echo.
echo ===================================================
echo Done!
echo ===================================================
echo.
pause

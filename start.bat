@echo off
chcp 65001 >nul
title 错题本服务
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    python serve.py
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        py -3 serve.py
    ) else (
        echo [错误] 未找到 Python，请先安装 Python 3。
    )
)
pause

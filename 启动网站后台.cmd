@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Wind Studio - 网站后台
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22 或更新的 LTS 版本，然后重新双击本文件。
  pause
  exit /b 1
)
if not exist node_modules\astro\astro.js (
  echo 请先在本目录执行 npm install 安装依赖，然后重新启动。
  pause
  exit /b 1
)
node admin\launch.mjs
if errorlevel 1 pause

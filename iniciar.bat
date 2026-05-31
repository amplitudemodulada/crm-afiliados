@echo off
setlocal
title CRM Pro
set "BASE=%~dp0"
cd /d "%BASE%"

REM ── Localiza Node ───────────────────────────────────────────
where node >nul 2>&1
if not errorlevel 1 (
    set "NODE=node"
    goto :CHECK_DEPS
)

if exist "%BASE%node_portable\node.exe" (
    set "NODE=%BASE%node_portable\node.exe"
    goto :CHECK_DEPS
)

echo.
echo  ERRO: Node.js nao encontrado.
echo  Instale em https://nodejs.org ou coloque node.exe em:
echo  %BASE%node_portable\
echo.
pause
exit /b 1

REM ── Instala dependencias se necessario ──────────────────────
:CHECK_DEPS
if not exist "%BASE%node_modules\express" (
    echo Instalando dependencias, aguarde...
    "%NODE%" -e "require('child_process').execSync('npm install',{stdio:'inherit',cwd:'%BASE%'})"
    echo.
)

REM ── Le porta do .env (padrao 3000) ──────────────────────────
set "PORT=3000"
for /f "usebackq tokens=1,2 delims==" %%A in ("%BASE%.env") do (
    if /i "%%A"=="PORT" set "PORT=%%B"
)

REM ── Encerra servidor anterior se estiver rodando ────────────
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo Encerrando servidor anterior na porta %PORT%...
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
        taskkill /PID %%P /F >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

REM ── Inicia servidor em background ───────────────────────────
echo Iniciando CRM Pro na porta %PORT%...
start "CRM Pro - Servidor" /min "%NODE%" "%BASE%src\server.js"

REM ── Aguarda servidor responder (ate 10s) ────────────────────
set /a TENTATIVAS=0
:AGUARDAR
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto :ABRIR
set /a TENTATIVAS+=1
if %TENTATIVAS% lss 10 goto :AGUARDAR

echo Servidor nao respondeu a tempo. Abrindo assim mesmo...

REM ── Abre navegador ──────────────────────────────────────────
:ABRIR
start "" "http://localhost:%PORT%"
exit /b 0

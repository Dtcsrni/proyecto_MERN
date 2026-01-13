@echo off
setlocal
set ROOT=%~dp0..
pushd "%ROOT%"
echo Iniciando entorno dev (Docker + Web)...
npm run dev
popd
pause

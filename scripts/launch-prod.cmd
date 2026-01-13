@echo off
setlocal
set ROOT=%~dp0..
pushd "%ROOT%"
echo Iniciando entorno prod (Docker API docente)...
npm start
popd
pause

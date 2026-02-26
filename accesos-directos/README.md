# accesos-directos/

Accesos directos (Windows) para abrir **Sistema EvaluaPro (EP)** en modo dev/prod.

- Este folder se llena/actualiza con `../scripts/create-shortcuts.ps1`.
- Regeneración recomendada (incluye Desktop + Menú Inicio):
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force`
- Accesos incluidos por defecto:
  - `EvaluaPro - Dev`
  - `EvaluaPro - Prod`
  - `EvaluaPro - Abrir Dashboard`
  - `EvaluaPro - Reiniciar Stack`
  - `EvaluaPro - Detener Todo`
  - `EvaluaPro - Reparar Entorno`

Si no aparecen o el icono no se actualiza, vuelve a generar:
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force`

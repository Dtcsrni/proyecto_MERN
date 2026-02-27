# Runbook de Saneamiento de Historial Git

Objetivo: eliminar datos sensibles del historial publico del repositorio.

## Advertencia
La reescritura de historial cambia hashes de commits. Requiere ventana de freeze y re-clonado.

## Pasos recomendados
1. Congelar merges y notificar equipo.
2. Crear respaldo espejo del remoto.
3. Ejecutar `git filter-repo` con reglas de eliminacion para:
   - `backups/*.ep-sync.json`
   - `apps/backend/storage/**`
   - fixtures sensibles historicos
4. Forzar push de ramas publicas saneadas.
5. Revocar tokens/secretos potencialmente expuestos.
6. Rehabilitar flujo de trabajo y exigir reclonado.

## Verificacion posterior
- `npm run test:compliance:pii`
- revision manual de tags/releases historicas
- checklist legal y seguridad firmado

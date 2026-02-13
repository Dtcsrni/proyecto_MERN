# Mermaid Config

Archivo fuente: `docs/diagramas/mermaid.config.json`.

Este documento explica el contrato del archivo JSON de configuración de Mermaid.
El JSON se mantiene sin comentarios inline para preservar compatibilidad con herramientas.

## Objetivo

Definir parámetros de render estables y reproducibles para los diagramas Mermaid del proyecto.

## Claves actuales

### `deterministicIds`
- Tipo: `boolean`
- Valor actual: `true`
- Efecto:
  - fuerza generación determinista de IDs internos en SVG/DOM.
  - reduce diffs ruidosos entre corridas de render.
- Cuándo cambiar:
  - casi nunca; desactivarlo puede aumentar ruido en control de versiones.

### `deterministicIDSeed`
- Tipo: `string`
- Valor actual: `"evaluapro"`
- Efecto:
  - semilla para IDs deterministas.
  - mientras se mantenga constante, la salida SVG tiende a ser más estable.
- Cuándo cambiar:
  - solo si se decide resetear identidad de artefactos renderizados de forma controlada.

### `themeVariables.handDrawnSeed`
- Tipo: `number`
- Valor actual: `1`
- Efecto:
  - controla la variabilidad visual del estilo "hand-drawn" cuando aplica.
  - mantiene consistencia visual entre renders.
- Cuándo cambiar:
  - únicamente si se busca ajustar estética global de diagramas.

## Criterios de mantenimiento

1. Mantener JSON válido (sin comentarios inline).
2. Documentar aquí cualquier clave nueva antes de merge.
3. Si cambia un valor, regenerar y verificar artefactos:
   - `npm run diagramas:render`
   - `npm run diagramas:render:check`
4. Registrar cambios en `CHANGELOG.md`.

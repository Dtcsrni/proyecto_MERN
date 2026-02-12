# Arquitectura C4

Documenta el sistema desde 4 vistas C4 ya renderizadas.

## 1. Contexto
Fuente Mermaid: `docs/diagramas/src/c4/arquitectura-c4-context.mmd`

![C4 contexto](diagramas/rendered/c4/arquitectura-c4-context.svg)

## 2. Contenedores
Fuente Mermaid: `docs/diagramas/src/c4/arquitectura-c4-container.mmd`

![C4 contenedores](diagramas/rendered/c4/arquitectura-c4-container.svg)

## 3. Componentes API docente (core)
Fuente Mermaid: `docs/diagramas/src/c4/arquitectura-c4-component.mmd`

![C4 componentes API docente (core)](diagramas/rendered/c4/arquitectura-c4-component.svg)

## 4. Componentes API docente (integraciones)
Fuente Mermaid: `docs/diagramas/src/c4/arquitectura-c4-component-integraciones.mmd`

![C4 componentes API docente (integraciones)](diagramas/rendered/c4/arquitectura-c4-component-integraciones.svg)

## Observaciones de estado actual
- El backend docente sigue siendo la fuente primaria operativa.
- El portal cloud es read-model sincronizado.
- OMR y calificacion automatica forman parte del core operativo del backend.
- RBAC se aplica en backend; frontend solo refleja permisos disponibles.

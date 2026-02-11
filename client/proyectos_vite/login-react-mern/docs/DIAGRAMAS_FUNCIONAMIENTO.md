## [BLOQUE DIDACTICO] docs/DIAGRAMAS_FUNCIONAMIENTO.md
- Que es: Catalogo de diagramas del sistema.
- Que hace: Documenta arquitectura y flujos de autenticacion/autorizacion con estandar de diagramado.
- Como lo hace: Usa Mermaid con tipologias C4/UML y nombres semanticos por archivo.

# Diagramas de Funcionamiento (login-react-mern)

## Convenciones usadas

- `Contexto`: C4 nivel sistema (vista de alto nivel).
- `Secuencia`: UML Sequence para casos de uso clave.
- `Actividad`: UML Activity para pipeline de control.
- `Estado`: UML State para ciclo de sesion en frontend.
- `Clase`: UML Class para modelo de dominio.

## Estilo visual

- Alto contraste: fondo blanco, texto oscuro, bordes oscuros.
- Nombres semanticos de archivo para trazabilidad.

## Diagramas fuente (`docs/diagramas/src`)

1. `arquitectura_contexto_sistema.mmd`
2. `secuencia_inicio_sesion.mmd`
3. `secuencia_restauracion_sesion_rbac.mmd`
4. `actividad_autorizacion_backend.mmd`
5. `estado_sesion_frontend.mmd`
6. `clase_usuario_autenticacion.mmd`

## Diagramas renderizados (`docs/diagramas/render`)

1. `arquitectura_contexto_sistema.svg`
2. `secuencia_inicio_sesion.svg`
3. `secuencia_restauracion_sesion_rbac.svg`
4. `actividad_autorizacion_backend.svg`
5. `estado_sesion_frontend.svg`
6. `clase_usuario_autenticacion.svg`

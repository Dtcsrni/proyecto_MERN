# EvaluaPro | Evaluacion Universitaria que Si Cierra Operativamente

EvaluaPro convierte el flujo academico completo en un proceso trazable y repetible: diseno de examen, impresion PDF, aplicacion, lectura OMR, calificacion y publicacion.

Esta version del repositorio sigue un enfoque **Open Core**:
- **Edicion gratuita (AGPL)**: cubre el flujo minimo que realmente resuelve operacion docente diaria.
- **Edicion comercial**: habilita capacidades avanzadas por tier, soporte y compromisos de roadmap.

## Propuesta de Valor Comercial
- Reduce reprocesos en captura/calificacion con flujos validados en CI.
- Minimiza riesgo operativo con contratos de API, OMR y release.
- Permite adopcion progresiva: iniciar gratis y escalar a licencia comercial sin migracion de plataforma.

## Ediciones y Licenciamiento
- `Free (AGPLv3)`: uso del core abierto bajo `LICENSE`.
- `Commercial Pro` y `Commercial Enterprise`: `LICENSE-COMMERCIAL.md`.
- Modalidades comerciales: mensual, semestral, anual y pago unico recomendado.
- Detalle de tiers: [docs/comercial/LICENSING_TIERS.md](docs/comercial/LICENSING_TIERS.md).

## Funciones Confiables
Las funciones se sincronizan automaticamente desde rutas activas del backend + evidencia de pruebas.

<!-- AUTO:FEATURES:START -->
## Funciones Confiables por Edicion

_Lista auto-sincronizada desde rutas reales del backend + evidencia de pruebas._

| Categoria | Free (AGPL) | Commercial Pro | Commercial Enterprise |
| --- | --- | --- | --- |
| Aplicacion y Captura | 2 | 0 | 0 |
| Calificacion | 1 | 2 | 0 |
| Cumplimiento | 0 | 0 | 1 |
| Gobernanza | 0 | 0 | 1 |
| Integraciones | 0 | 1 | 0 |
| Operacion Academica | 2 | 0 | 0 |
| Operacion Distribuida | 0 | 1 | 1 |
| Plataforma | 1 | 1 | 0 |
| Preparacion de Examenes | 2 | 0 | 0 |
| Seguridad | 1 | 0 | 0 |

- Catalogo completo: [docs/comercial/FEATURE_CATALOG.md](docs/comercial/FEATURE_CATALOG.md)
<!-- AUTO:FEATURES:END -->

## Roadmap Comercial (Promesas por Tier)
- `Free`: estabilidad del core y mejoras publicas sin SLA.
- `Commercial Pro`: prioridad en automatizacion docente y productividad.
- `Commercial Enterprise`: compromisos formales de roadmap, cumplimiento y soporte institucional.

Roadmap de producto/ingenieria: [docs/ROADMAP_REQUISITOS.md](docs/ROADMAP_REQUISITOS.md).

## Seguridad y Cumplimiento
- Politica de seguridad: [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md)
- Cumplimiento Mexico/Hidalgo: [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md)
- Aviso de privacidad: [docs/legal/aviso-privacidad-integral.md](docs/legal/aviso-privacidad-integral.md)
- Procedimiento ARCO: [docs/legal/procedimiento-arco.md](docs/legal/procedimiento-arco.md)

## Instalacion y Uso
- Releases: [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases)
- Installer Hub (Windows): [docs/INSTALLER_HUB.md](docs/INSTALLER_HUB.md)
- Desarrollo local:
```bash
npm install
npm run dev:backend
npm run dev:frontend
```

## Evidencia Tecnica
- Pipeline/gates: `npm run pipeline:contract:check`
- QA full: `npm run qa:full`
- Catalogo dinamico y README sync: `npm run docs:commercial:sync`
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Contacto Comercial
Para cotizacion de licencias comerciales, despliegue institucional y soporte, usar el canal definido por el equipo propietario del repositorio y adjuntar:
- volumen de alumnos/docentes,
- modalidad (local, hibrido, cloud),
- requerimientos de cumplimiento y SLA.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Presentacion comercial del producto y decision de compra/licencia.
- Edicion Free (AGPL): flujo operativo base para uso real.
- Edicion Commercial: mas automatizacion, soporte SLA, hardening y roadmap prioritario por tier.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->

# EvaluaPro | Evaluacion Universitaria 

EvaluaPro convierte el flujo academico completo en un proceso trazable y repetible: diseno de examen, impresion PDF, aplicacion, lectura OMR, calificacion y publicacion.

Esta version del repositorio sigue un enfoque **Open Core**:
- **Edicion gratuita (AGPL)**: cubre el flujo minimo que realmente resuelve operacion docente diaria.
- **Ediciones comercial e institucional**: habilitan capacidades avanzadas por nivel, soporte y compromisos de hoja de ruta.

## Propuesta de Valor Comercial
- Reduce reprocesos en captura/calificacion con flujos validados en CI.
- Minimiza riesgo operativo con contratos de API, OMR y release.
- Permite adopcion progresiva: iniciar gratis y escalar a licencia comercial sin migracion de plataforma.

## Ediciones y Licenciamiento
- `Edicion Comunitaria (AGPLv3)`: uso del core abierto bajo `LICENSE`.
- `Edicion Comercial` y `Edicion Institucional`: `LICENSE-COMMERCIAL.md`.
- Modalidades comerciales: mensual, semestral, anual y pago unico recomendado.
- Detalle de niveles: [docs/comercial/LICENSING_TIERS.md](docs/comercial/LICENSING_TIERS.md).
- Estrategia comercial: [docs/comercial/ESTRATEGIA_COMERCIAL.md](docs/comercial/ESTRATEGIA_COMERCIAL.md).

## Funciones actuales
Las funciones se sincronizan automaticamente desde rutas activas del backend + evidencia de pruebas.

<!-- AUTO:FEATURES:START -->
## Funciones Confiables por Edicion

_Lista auto-sincronizada desde rutas reales del backend + evidencia de pruebas._

| Categoria | Edicion Comunitaria (AGPL) | Edicion Comercial | Edicion Institucional |
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

## Hoja de Ruta Comercial (Promesas por Nivel)
- `Edicion Comunitaria`: estabilidad del core y mejoras publicas sin SLA.
- `Edicion Comercial`: prioridad en automatizacion docente y productividad.
- `Edicion Institucional`: compromisos formales de hoja de ruta, cumplimiento y soporte institucional.

Hoja de ruta de producto/ingenieria: [docs/ROADMAP_REQUISITOS.md](docs/ROADMAP_REQUISITOS.md).

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
Para cotizacion de licencias comerciales, despliegue institucional y soporte, escribir a `armsystechno@gmail.com` y adjuntar:
- volumen de alumnos/docentes,
- modalidad (local, hibrido, cloud),
- requerimientos de cumplimiento y SLA.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Presentacion comercial del producto y decision de compra/licencia.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->

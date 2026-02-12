# Sincronizacion entre computadoras (paquete)

Permite mover datos operativos entre instalaciones del sistema mediante archivo de paquete.

## Cobertura de sincronizacion
- Periodos/materias
- Alumnos
- Banco de preguntas
- Plantillas
- Examenes generados
- Entregas, banderas y calificaciones
- PDFs comprimidos (opcional)

## Garantias
- Importacion idempotente.
- Resolucion por recencia (`updatedAt`) para conflictos.
- Validacion de integridad por checksum SHA-256.

## Flujo de uso
1. Exportar paquete en equipo origen.
2. Transferir archivo.
3. Validar/importar en equipo destino (dry-run + confirmacion).

## Endpoints backend
- `POST /api/sincronizaciones/paquete/exportar`
- `POST /api/sincronizaciones/paquete/importar`
- `POST /api/sincronizaciones/push`
- `POST /api/sincronizaciones/pull`

## Seguridad
- Requiere sesion docente y permisos de sincronizacion.
- Se valida compatibilidad de docente antes de aplicar importacion.
- En entorno cloud, operaciones internas usan API key.

## Recomendaciones
- Evitar incluir PDFs salvo cuando sea necesario (peso del paquete).
- Mantener respaldo antes de importaciones masivas.
- Ejecutar dry-run siempre en migraciones entre equipos.

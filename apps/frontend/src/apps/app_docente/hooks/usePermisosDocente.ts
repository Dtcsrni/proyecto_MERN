/**
 * usePermisosDocente
 *
 * Responsabilidad: Hook transversal del shell docente.
 * Limites: Mantener estado derivado predecible y efectos idempotentes.
 */
import { useCallback, useMemo } from 'react';
import type { Docente } from '../tipos';

export function usePermisosDocente(docente: Docente | null) {
  const esDev = import.meta.env.DEV;
  const esAdmin = Boolean(docente?.roles?.includes('admin'));
  const permisosDocente = useMemo(() => new Set(docente?.permisos ?? []), [docente?.permisos]);
  const puede = useCallback((permiso: string) => permisosDocente.has(permiso), [permisosDocente]);

  const permisosUI = useMemo(
    () => ({
      periodos: {
        leer: puede('periodos:leer'),
        gestionar: puede('periodos:gestionar'),
        archivar: puede('periodos:archivar')
      },
      alumnos: {
        leer: puede('alumnos:leer'),
        gestionar: puede('alumnos:gestionar')
      },
      banco: {
        leer: puede('banco:leer'),
        gestionar: puede('banco:gestionar'),
        archivar: puede('banco:archivar')
      },
      plantillas: {
        leer: puede('plantillas:leer'),
        gestionar: puede('plantillas:gestionar'),
        archivar: puede('plantillas:archivar'),
        previsualizar: puede('plantillas:previsualizar')
      },
      examenes: {
        leer: puede('examenes:leer'),
        generar: puede('examenes:generar'),
        archivar: puede('examenes:archivar'),
        regenerar: puede('examenes:regenerar'),
        descargar: puede('examenes:descargar')
      },
      entregas: { gestionar: puede('entregas:gestionar') },
      omr: { analizar: puede('omr:analizar') },
      calificaciones: { calificar: puede('calificaciones:calificar') },
      evaluaciones: { leer: puede('evaluaciones:leer'), gestionar: puede('evaluaciones:gestionar') },
      classroom: { conectar: puede('classroom:conectar'), pull: puede('classroom:pull') },
      publicar: { publicar: puede('calificaciones:publicar') },
      sincronizacion: {
        listar: puede('sincronizacion:listar'),
        exportar: puede('sincronizacion:exportar'),
        importar: puede('sincronizacion:importar'),
        push: puede('sincronizacion:push'),
        pull: puede('sincronizacion:pull')
      },
      cuenta: { leer: puede('cuenta:leer'), actualizar: puede('cuenta:actualizar') }
    }),
    [puede]
  );

  const puedeEliminarPlantillaDev = esDev && esAdmin && puede('plantillas:eliminar_dev');
  const puedeEliminarMateriaDev = esDev && esAdmin && puede('periodos:eliminar_dev');
  const puedeEliminarAlumnoDev = esDev && esAdmin && puede('alumnos:eliminar_dev');

  const itemsVista = useMemo(() => {
    const puedeCalificar = puede('calificaciones:calificar') || puede('omr:analizar');
    const puedePublicar = puede('sincronizacion:listar') || puede('calificaciones:publicar');
    const items = [
      { id: 'periodos', label: 'Materias', icono: 'periodos' as const, mostrar: puede('periodos:leer') },
      { id: 'alumnos', label: 'Alumnos', icono: 'alumnos' as const, mostrar: puede('alumnos:leer') },
      { id: 'banco', label: 'Banco', icono: 'banco' as const, mostrar: puede('banco:leer') },
      { id: 'plantillas', label: 'Plantillas', icono: 'plantillas' as const, mostrar: puede('plantillas:leer') },
      { id: 'entrega', label: 'Entrega', icono: 'recepcion' as const, mostrar: puede('entregas:gestionar') },
      { id: 'calificaciones', label: 'Calificaciones', icono: 'calificar' as const, mostrar: puedeCalificar },
      { id: 'evaluaciones', label: 'Evaluaciones', icono: 'calificar' as const, mostrar: puede('evaluaciones:leer') },
      { id: 'publicar', label: 'Sincronización', icono: 'publicar' as const, mostrar: puedePublicar },
      { id: 'cuenta', label: 'Cuenta', icono: 'info' as const, mostrar: puede('cuenta:leer') }
    ];
    return items.filter((item) => item.mostrar);
  }, [puede]);

  return {
    puede,
    permisosUI,
    itemsVista,
    esAdmin,
    esDev,
    puedeEliminarPlantillaDev,
    puedeEliminarMateriaDev,
    puedeEliminarAlumnoDev
  };
}

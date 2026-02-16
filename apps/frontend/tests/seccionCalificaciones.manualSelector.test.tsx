import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';
import type { Alumno, PermisosUI } from '../src/apps/app_docente/tipos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/SeccionEscaneo', () => ({
  SeccionEscaneo: () => <div data-testid="escaneo-mock">Escaneo mock</div>,
  QrAccesoMovil: () => null
}));

const obtenerMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    baseApi: '/api'
  }
}));

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const alumno = {
  _id: 'alu-1',
  nombreCompleto: 'Alumno Uno',
  matricula: 'A001',
  grupo: 'A',
  periodoId: 'per-1'
} as unknown as Alumno;

describe('SeccionCalificaciones manual selector', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') {
        return {
          plantillas: [{ _id: 'pla-1', titulo: 'Plantilla Algebra', tipo: 'parcial', numeroPaginas: 1 }]
        };
      }
      if (ruta.startsWith('/examenes/generados?alumnoId=')) {
        return {
          examenes: [
            {
              _id: 'ex-1',
              folio: 'FOL-1',
              alumnoId: 'alu-1',
              estado: 'entregado',
              plantillaId: 'pla-1',
              tipoExamen: 'parcial',
              plantillaTitulo: 'Plantilla Algebra',
              entregadoEn: '2026-02-16T00:00:00.000Z'
            }
          ]
        };
      }
      if (ruta === '/examenes/generados/folio/FOL-1') {
        return {
          examen: {
            _id: 'ex-1',
            folio: 'FOL-1',
            alumnoId: 'alu-1',
            periodoId: 'per-1',
            mapaVariante: { ordenPreguntas: ['p1'] }
          }
        };
      }
      if (ruta === '/banco-preguntas?periodoId=per-1') {
        return {
          preguntas: [
            {
              _id: 'p1',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 1',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            }
          ]
        };
      }
      return {};
    });
  });

  it('muestra tipo en selector y en encabezado al activar modo manual', async () => {
    const user = userEvent.setup();

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas'));

    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /FOL-1 · Parcial 1 · Plantilla Algebra · entregado/i })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Examen entregado'), 'ex-1');
    await user.click(screen.getByRole('button', { name: /Usar examen para calificación manual/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Calificar examen · Parcial 1/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Modo manual activo · Folio FOL-1 · Tipo Parcial 1 · Plantilla Plantilla Algebra/i)).toBeInTheDocument();
    expect((clienteApi as { obtener: unknown }).obtener).toBeDefined();
  });
});

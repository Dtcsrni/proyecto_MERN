import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionEvaluaciones } from '../src/apps/app_docente/SeccionEvaluaciones';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionEvaluaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta: string) => {
      if (String(ruta).startsWith('/evaluaciones/politicas')) {
        return {
          politicas: [
            { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC' },
            { codigo: 'POLICY_SV_EXCEL_2026', version: 1, nombre: 'SV' }
          ]
        };
      }
      if (String(ruta).startsWith('/evaluaciones/configuracion-periodo')) {
        return { configuracion: { politicaCodigo: 'POLICY_LISC_ENCUADRE_2026', politicaVersion: 1 } };
      }
      if (String(ruta).startsWith('/integraciones/classroom/mapear')) {
        return { mapeos: [] };
      }
      return {};
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  it('renderiza y guarda configuración de política', async () => {
    render(
      <SeccionEvaluaciones
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar
        puedeClassroom
      />
    );

    expect(screen.getByRole('heading', { name: /Evaluaciones y políticas/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(clienteApi.obtener)).toHaveBeenCalledWith('/evaluaciones/politicas');
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar política/i }));

    await waitFor(() => {
      expect(vi.mocked(clienteApi.enviar)).toHaveBeenCalledWith(
        '/evaluaciones/configuracion-periodo',
        expect.objectContaining({
          periodoId: 'per-1',
          politicaCodigo: 'POLICY_LISC_ENCUADRE_2026'
        })
      );
    });
  });
});

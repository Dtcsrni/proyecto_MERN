import { clienteApi } from './clienteApiDocente';
import { obtenerSesionDocenteId } from './utilidades';

export function registrarAccionDocente(accion: string, exito: boolean, duracionMs?: number) {
  void clienteApi.registrarEventosUso({
    eventos: [
      {
        sessionId: obtenerSesionDocenteId() ?? undefined,
        pantalla: 'docente',
        accion,
        exito,
        duracionMs
      }
    ]
  });
}

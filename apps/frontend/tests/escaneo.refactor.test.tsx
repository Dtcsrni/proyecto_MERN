import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrAccesoMovil, SeccionEscaneo } from '../src/apps/app_docente/SeccionEscaneo';

describe('escaneo refactor comportamiento', () => {
  it('renderiza la mesa de escaneo con secciones principales', () => {
    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasCombinadas={[]}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /Escaneo y revisión OMR/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Captura individual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lote de imagenes/i })).toBeInTheDocument();
  });

  it('expone QR de acceso móvil', () => {
    expect(typeof QrAccesoMovil).toBe('function');
  });
});

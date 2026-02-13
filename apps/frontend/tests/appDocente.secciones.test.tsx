import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppDocente secciones (refactor)', () => {
  it('muestra tabs principales con token', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Materias' })).toBeInTheDocument();
  });
});

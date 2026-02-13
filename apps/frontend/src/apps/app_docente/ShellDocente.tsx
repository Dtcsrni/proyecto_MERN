import type { ReactNode } from 'react';
import { Icono } from '../../ui/iconos';
import { TemaBoton } from '../../tema/TemaBoton';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import type { Docente } from './tipos';

export function ShellDocente({
  docente,
  onCerrarSesion,
  children
}: {
  docente: Docente | null;
  onCerrarSesion: () => void;
  children: ReactNode;
}) {
  return (
    <section className="card anim-entrada">
      <div className="cabecera">
        <div>
          <p className="eyebrow">
            <Icono nombre="docente" /> Plataforma Docente
          </p>
          <h1>Banco y Examenes</h1>
        </div>
        <div className="cabecera__acciones">
          <TemaBoton />
          {docente && (
            <Boton variante="secundario" type="button" icono={<Icono nombre="salir" />} onClick={onCerrarSesion}>
              Salir
            </Boton>
          )}
        </div>
      </div>
      {docente && (
        <InlineMensaje tipo="info">
          Sesion: {[docente.nombres, docente.apellidos].filter(Boolean).join(' ').trim() || docente.nombreCompleto} ({docente.correo})
        </InlineMensaje>
      )}
      {children}
    </section>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../../iconos';

export function Boton({
  variante = 'primario',
  cargando = false,
  icono,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario';
  cargando?: boolean;
  icono?: ReactNode;
  children: ReactNode;
}) {
  const clases = [
    'boton',
    variante === 'secundario' ? 'secundario' : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...props} className={clases} disabled={Boolean(disabled) || cargando}>
      {cargando ? <Spinner /> : icono}
      {children}
    </button>
  );
}

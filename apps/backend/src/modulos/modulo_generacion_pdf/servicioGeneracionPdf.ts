/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 *
 * Fachada del dominio PDF.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';
import type { TemplateVersion } from './shared/tiposPdf';

/**
 * Fachada que delega al caso de uso modular.
 */
export async function generarPdfExamen({
  titulo,
  folio,
  preguntas,
  mapaVariante,
  tipoExamen,
  totalPaginas,
  margenMm = 10,
  encabezado,
  templateVersion = 3
}: {
  titulo: string;
  folio: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: 'parcial' | 'global';
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: TemplateVersion;
  encabezado?: {
    institucion?: string;
    lema?: string;
    materia?: string;
    docente?: string;
    instrucciones?: string;
    alumno?: { nombre?: string; grupo?: string };
    mostrarInstrucciones?: boolean;
    logos?: { izquierdaPath?: string; derechaPath?: string };
  };
}) {
  void templateVersion;
  const resultado = await generarExamenIndividual({
    titulo,
    folio,
    preguntas,
    mapaVariante,
    tipoExamen,
    totalPaginas,
    margenMm,
    encabezado,
    templateVersion: 3
  });
  return resultado;
}

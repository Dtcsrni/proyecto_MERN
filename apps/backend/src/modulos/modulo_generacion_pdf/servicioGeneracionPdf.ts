/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 * 
 * Fachada del dominio PDF para delegar en use case modular.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';

type TemplateVersion = 1 | 2;

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
  templateVersion = 1
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
  return generarExamenIndividual({
    titulo,
    folio,
    preguntas,
    mapaVariante,
    tipoExamen,
    totalPaginas,
    margenMm,
    encabezado,
    templateVersion
  });
}

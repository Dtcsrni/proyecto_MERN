/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 * 
 * Fachada del dominio PDF con canary y fallback seguro.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import { registrarAdopcion } from '../../compartido/observabilidad/metricsAdopcion';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';
import type { TemplateVersion } from './shared/tiposPdf';
const ENDPOINT_ADOPCION = '/modulo_generacion_pdf/generarPdfExamen';

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
  registrarAdopcion('pdf', ENDPOINT_ADOPCION, 'v2');
  return resultado;
}

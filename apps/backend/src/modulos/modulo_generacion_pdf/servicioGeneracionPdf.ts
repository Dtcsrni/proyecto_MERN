/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 * 
 * Fachada con feature flag canary para activar motor modular v2 (Ola 2B).
 * 
 * Feature flag: FEATURE_PDF_BUILDER_V2 (0|1)
 * - 0 o ausente: usa motor legado (por defecto)
 * - 1: usa motor modular v2 (en desarrollo Ola 2B)
 * 
 * Observabilidad: tracking de adopcion v2 via logs estructurados.
 */
import { generarPdfExamen as generarPdfExamenLegacy } from './servicioGeneracionPdfLegacy';
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';

type TemplateVersion = 1 | 2;

function leerFeatureFlagPdfV2(): boolean {
  const valor = String(process.env.FEATURE_PDF_BUILDER_V2 ?? '0').trim();
  return valor === '1' || valor.toLowerCase() === 'true';
}

/**
 * Fachada que selecciona entre motor legado y v2 segun feature flag.
 * TODO Ola 2B: agregar metricas Prometheus cuando el motor v2 este completo.
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
  const usarMotorV2 = leerFeatureFlagPdfV2();

  if (usarMotorV2) {
    // Motor modular v2 (Ola 2B - en desarrollo)
    // TODO Ola 2B: agregar metricas de observabilidad
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

  // Motor legado (por defecto)
  return generarPdfExamenLegacy({
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

/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 * 
 * Fachada del dominio PDF con canary y fallback seguro.
 */
import { generarExamenIndividual } from './application/usecases/generarExamenIndividual';
import { generarPdfExamen as generarPdfExamenLegacy } from './servicioGeneracionPdfLegacy';
import { decidirVersionCanary } from '../../compartido/observabilidad/rolloutCanary';
import { registrarAdopcion } from '../../compartido/observabilidad/metricsAdopcion';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';

type TemplateVersion = 1 | 2;
const ENDPOINT_ADOPCION = '/modulo_generacion_pdf/generarPdfExamen';

function construirSemillaCanary(params: {
  folio: string;
  titulo: string;
  totalPaginas: number;
  templateVersion: TemplateVersion;
  preguntas: PreguntaBase[];
}) {
  const ids = Array.isArray(params.preguntas)
    ? params.preguntas
        .map((pregunta) => String(pregunta?.id ?? '').trim())
        .filter(Boolean)
        .slice(0, 5)
        .join('|')
    : '';

  return [
    String(params.folio ?? '').trim(),
    String(params.titulo ?? '').trim(),
    String(params.totalPaginas ?? ''),
    String(params.templateVersion ?? ''),
    String(params.preguntas?.length ?? 0),
    ids
  ].join(':');
}

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
  const version = decidirVersionCanary(
    'pdf',
    construirSemillaCanary({
      folio,
      titulo,
      totalPaginas,
      templateVersion,
      preguntas
    })
  );

  if (version === 'v1') {
    registrarAdopcion('pdf', ENDPOINT_ADOPCION, 'v1');
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

  try {
    const resultado = await generarExamenIndividual({
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
    registrarAdopcion('pdf', ENDPOINT_ADOPCION, 'v2');
    return resultado;
  } catch {
    registrarAdopcion('pdf', ENDPOINT_ADOPCION, 'v1');
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
}

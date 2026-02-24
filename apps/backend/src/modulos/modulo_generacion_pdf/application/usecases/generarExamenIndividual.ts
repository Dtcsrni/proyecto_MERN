/**
 * Use case: Generar Examen Individual
 * 
 * Orquesta la generacion de un PDF de examen individual con todas sus paginas,
 * metadata OMR y validaciones de negocio.
 * 
 * Responsabilidad: coordinar domain + infra sin logica de rendering.
 */
import type {
  ParametrosGeneracionPdf,
  ResultadoGeneracionPdf
} from '../../shared/tiposPdf';
import { ExamenPdf } from '../../domain/examenPdf';
import { obtenerPerfilPlantilla } from '../../domain/layoutExamen';
import { resolverPerfilLayout } from '../../infra/configuracionLayoutEnv';
import { PdfKitRenderer } from '../../infra/pdfKitRenderer';
import {
  normalizarMapaVarianteTv3,
  normalizarPreguntasParaTv3,
  TEMPLATE_VERSION_TV3
} from '../../domain/tv3Compat';

/**
 * Genera un PDF de examen individual.
 * 
 * Implementacion modular: dominio + infraestructura desacoplada.
 */
export async function generarExamenIndividual(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf> {
  const preguntas = normalizarPreguntasParaTv3(params.preguntas);
  const mapaVariante = normalizarMapaVarianteTv3(preguntas, params.mapaVariante);

  const templateVersion = TEMPLATE_VERSION_TV3;
  const totalPaginas = Number.isFinite(params.totalPaginas)
    ? Math.max(1, Math.floor(params.totalPaginas))
    : 1;
  const margenMm = Number.isFinite(params.margenMm)
    ? Math.max(4.5, Number(params.margenMm))
    : 8;

  const examen = new ExamenPdf(
    params.titulo?.trim() || 'Examen',
    params.folio?.trim() || 'SIN-FOLIO',
    preguntas,
    mapaVariante,
    params.tipoExamen,
    {
      margenMm,
      templateVersion,
      totalPaginas
    },
    params.encabezado
  );

  const perfilOmr = obtenerPerfilPlantilla(templateVersion);
  const perfilLayout = resolverPerfilLayout();
  const renderer = new PdfKitRenderer(perfilOmr, perfilLayout);
  return renderer.generarPdf(examen);
}

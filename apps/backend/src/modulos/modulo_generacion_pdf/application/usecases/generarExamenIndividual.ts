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
  PreguntaBase,
  ResultadoGeneracionPdf
} from '../../shared/tiposPdf';
import { ExamenPdf } from '../../domain/examenPdf';
import { obtenerPerfilPlantilla } from '../../domain/layoutExamen';
import { resolverPerfilLayout } from '../../infra/configuracionLayoutEnv';
import { PdfKitRenderer } from '../../infra/pdfKitRenderer';

/**
 * Genera un PDF de examen individual.
 * 
 * Implementacion modular: dominio + infraestructura desacoplada.
 */
export async function generarExamenIndividual(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf> {
  const preguntas: PreguntaBase[] =
    Array.isArray(params.preguntas) && params.preguntas.length > 0
      ? params.preguntas
      : [
          {
            id: 'placeholder-1',
            enunciado: 'Pregunta de respaldo',
            opciones: [
              { texto: 'A', esCorrecta: false },
              { texto: 'B', esCorrecta: false },
              { texto: 'C', esCorrecta: false },
              { texto: 'D', esCorrecta: false }
            ]
          }
        ];

  const mapaVariante =
    params.mapaVariante && Array.isArray(params.mapaVariante.ordenPreguntas)
      ? params.mapaVariante
      : {
          ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
          ordenOpcionesPorPregunta: Object.fromEntries(
            preguntas.map((pregunta) => [
              pregunta.id,
              pregunta.opciones.map((_, indice) => indice)
            ])
          )
        };

  const templateVersion = params.templateVersion === 2 ? 2 : 1;
  const totalPaginas = Number.isFinite(params.totalPaginas)
    ? Math.max(1, Math.floor(params.totalPaginas))
    : 1;
  const margenMm = Number.isFinite(params.margenMm)
    ? Math.max(5, Number(params.margenMm))
    : 10;

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

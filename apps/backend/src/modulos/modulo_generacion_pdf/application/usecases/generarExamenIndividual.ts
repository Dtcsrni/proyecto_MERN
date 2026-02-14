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
import { generarPdfExamen as generarPdfExamenLegacy } from '../../servicioGeneracionPdfLegacy';

/**
 * Genera un PDF de examen individual.
 * 
 * TODO Ola 2B: Implementar logica modular usando:
 * - ExamenPdf (domain) para validaciones
 * - PdfKitRenderer (infra) para rendering
 * - ConfiguracionLayoutEnv (infra) para configuracion
 * 
 * Por ahora delega al legado mientras se completa la implementacion.
 */
export async function generarExamenIndividual(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf> {
  // TODO: Implementar con arquitectura modular
  // const examen = new ExamenPdf(...)
  // const perfil = obtenerPerfilPlantilla(params.templateVersion)
  // const layout = resolverPerfilLayout()
  // const renderer = new PdfKitRenderer(perfil, layout)
  // return renderer.generarPdf(examen)

  // Delegacion temporal al legado
  return generarPdfExamenLegacy(params);
}

/**
 * Tipos compartidos para el dominio de generacion de PDFs.
 * 
 * Define DTOs, types y constantes compartidas entre capas del modulo.
 */

export type TemplateVersion = 1 | 2;
export type TipoExamen = 'parcial' | 'global';

export interface EncabezadoExamen {
  institucion?: string;
  lema?: string;
  materia?: string;
  docente?: string;
  instrucciones?: string;
  alumno?: { nombre?: string; grupo?: string };
  mostrarInstrucciones?: boolean;
  logos?: { izquierdaPath?: string; derechaPath?: string };
}

export interface ParametrosGeneracionPdf {
  titulo: string;
  folio: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: TipoExamen;
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: TemplateVersion;
  encabezado?: EncabezadoExamen;
}

export interface PreguntaBase {
  id: string;
  enunciado: string;
  imagenUrl?: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
}

export interface MapaVariante {
  ordenPreguntas: string[];
  ordenOpcionesPorPregunta: Record<string, number[]>;
}

export interface ResultadoGeneracionPdf {
  pdfBytes: Buffer;
  paginas: Array<{
    numero: number;
    qrTexto: string;
    preguntasDel: number;
    preguntasAl: number;
  }>;
  metricasPaginas: Array<{
    numero: number;
    fraccionVacia: number;
    preguntas: number;
  }>;
  mapaOmr: MapaOmr;
  preguntasRestantes: number;
}

export interface MapaOmr {
  margenMm: number;
  templateVersion: number;
  perfilLayout: PerfilLayoutImpresion;
  perfil: PerfilPlantillaOmr;
  paginas: PaginaOmr[];
}

export interface PerfilLayoutImpresion {
  gridStepPt: number;
  headerHeightFirst: number;
  headerHeightOther: number;
  bottomSafePt: number;
  usarRellenosDecorativos: boolean;
  usarEtiquetaOmrSolida: boolean;
}

export interface PerfilPlantillaOmr {
  qrSize: number;
  qrPadding: number;
  qrMarginModulos: number;
  marcasEsquina: 'lineas' | 'cuadrados';
  marcaCuadradoSize: number;
  marcaCuadradoQuietZone: number;
  burbujaRadio: number;
  burbujaPasoY: number;
  cajaOmrAncho: number;
  fiducialSize: number;
}

export interface PaginaOmr {
  numeroPagina: number;
  qr: {
    texto: string;
    x: number;
    y: number;
    size: number;
    padding: number;
  };
  marcasPagina: {
    tipo: 'lineas' | 'cuadrados';
    size: number;
    quietZone: number;
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    bl: { x: number; y: number };
    br: { x: number; y: number };
  };
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
    cajaOmr?: { x: number; y: number; width: number; height: number };
    perfilOmr?: { radio: number; pasoY: number; cajaAncho: number };
    fiduciales?: {
      leftTop: { x: number; y: number };
      leftBottom: { x: number; y: number };
      rightTop: { x: number; y: number };
      rightBottom: { x: number; y: number };
    };
  }>;
}

// Constantes de formato carta (puntos PostScript)
export const ANCHO_CARTA = 612;
export const ALTO_CARTA = 792;
export const MM_A_PUNTOS = 72 / 25.4;

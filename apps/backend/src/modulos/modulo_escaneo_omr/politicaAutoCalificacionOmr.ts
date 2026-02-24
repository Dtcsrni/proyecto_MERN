type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';

export type EntradaAutoCalificacionOmr = {
  estadoAnalisis?: EstadoAnalisisOmr;
  calidadPagina: number;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  coberturaDeteccion: number;
};

export const UMBRALES_OMR_AUTO = {
  qualityRejectMin: Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.5'),
  qualityReviewMin: Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.55'),
  autoConfMin: Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.62'),
  autoAmbiguasMax: Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.3'),
  autoDeteccionMin: Number.parseFloat(process.env.OMR_AUTO_DETECCION_MIN || '0.7'),
  autoRescueQualityMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.54'),
  autoRescueConfMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.62'),
  autoRescueAmbigMax: Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.3')
} as const;

function clamp01(valor: number) {
  return Math.max(0, Math.min(1, valor));
}

export function evaluarRescateAltaPrecisionOmr(args: Omit<EntradaAutoCalificacionOmr, 'estadoAnalisis' | 'coberturaDeteccion'>) {
  const { calidadPagina, confianzaPromedioPagina, ratioAmbiguas } = args;
  return (
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.autoRescueQualityMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoRescueConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoRescueAmbigMax
  );
}

export function evaluarAutoCalificableOmr(args: EntradaAutoCalificacionOmr) {
  const {
    estadoAnalisis,
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas,
    coberturaDeteccion
  } = args;
  const rescateAltaPrecision = evaluarRescateAltaPrecisionOmr({
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas
  });
  const cumpleBase =
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.qualityReviewMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoAmbiguasMax &&
    clamp01(coberturaDeteccion) >= UMBRALES_OMR_AUTO.autoDeteccionMin;

  return {
    rescateAltaPrecision,
    autoCalificableOmr: estadoAnalisis === 'ok' && (cumpleBase || rescateAltaPrecision)
  };
}

type PlantillaCompat = {
  numeroPaginas?: unknown;
  totalReactivos?: unknown;
  tipo?: unknown;
};

export function resolverNumeroPaginasPlantilla(plantilla: PlantillaCompat): number {
  const numeroPaginas = Number(plantilla?.numeroPaginas);
  if (Number.isFinite(numeroPaginas) && numeroPaginas >= 1) {
    return Math.floor(numeroPaginas);
  }

  const totalReactivosLegacy = Number(plantilla?.totalReactivos);
  if (Number.isFinite(totalReactivosLegacy) && totalReactivosLegacy >= 1) {
    return String(plantilla?.tipo ?? '').trim().toLowerCase() === 'parcial' ? 2 : 4;
  }

  return 1;
}
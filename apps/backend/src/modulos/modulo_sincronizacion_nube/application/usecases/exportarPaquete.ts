import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { DefaultPaqueteAssembler, parsearDesdeRaw } from '../../domain/paqueteSincronizacion';
import { MongoSyncDataRepo, syncClock } from '../../infra/repositoriosSync';
import { Sincronizacion } from '../../modeloSincronizacion';

const assembler = new DefaultPaqueteAssembler();
const dataRepo = new MongoSyncDataRepo();

export async function exportarPaqueteUseCase(params: {
  docenteId: string;
  periodoIdRaw?: unknown;
  desdeRaw?: unknown;
  incluirPdfsRaw?: unknown;
}) {
  const { docenteId, periodoIdRaw, desdeRaw, incluirPdfsRaw } = params;
  const docenteCorreo = await dataRepo.obtenerCorreoDocente(String(docenteId));
  const periodoId = String(periodoIdRaw ?? '').trim();
  const desdeRawStr = String(desdeRaw ?? '').trim();
  const incluirPdfs = incluirPdfsRaw !== false;

  const desde = parsearDesdeRaw(desdeRawStr);
  if (desdeRawStr && !desde) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }

  const { paquete, paqueteBase64, checksumSha256, checksumGzipSha256, exportadoEn } = await assembler.generar({
    docenteId: String(docenteId),
    docenteCorreo,
    periodoId: periodoId || undefined,
    desde: desde || undefined,
    incluirPdfs
  });

  await Sincronizacion.create({
    docenteId,
    estado: 'exitoso',
    tipo: 'paquete_export',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, conteos: paquete.conteos },
    ejecutadoEn: syncClock.now()
  });

  return {
    paqueteBase64,
    checksumSha256,
    checksumGzipSha256,
    exportadoEn,
    conteos: paquete.conteos
  };
}

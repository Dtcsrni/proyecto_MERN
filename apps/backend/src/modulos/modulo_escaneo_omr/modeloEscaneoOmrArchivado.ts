/**
 * Modelo de escaneos OMR archivados (payload comprimido sin pérdidas).
 */
import { Schema, model, models } from 'mongoose';

const EscaneoOmrArchivadoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno' },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    plantillaId: { type: Schema.Types.ObjectId, ref: 'ExamenPlantilla' },
    examenGeneradoId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado', required: true },
    folio: { type: String, required: true },
    numeroPagina: { type: Number, required: true, min: 1 },
    materia: { type: String, trim: true },
    mimeType: { type: String, required: true },
    algoritmoCompresion: { type: String, enum: ['gzip'], default: 'gzip' },
    tamanoOriginalBytes: { type: Number, required: true, min: 1 },
    tamanoComprimidoBytes: { type: Number, required: true, min: 1 },
    sha256Original: { type: String, required: true },
    templateVersionDetectada: { type: Number, enum: [1, 2] },
    estadoAnalisis: { type: String, enum: ['ok', 'rechazado_calidad', 'requiere_revision'], required: true },
    payloadComprimido: { type: Buffer, required: true }
  },
  { timestamps: true, collection: 'escaneosOmrArchivados' }
);

EscaneoOmrArchivadoSchema.index({ examenGeneradoId: 1, numeroPagina: 1 }, { unique: true });
EscaneoOmrArchivadoSchema.index({ docenteId: 1, alumnoId: 1, materia: 1, createdAt: -1 });

export const EscaneoOmrArchivado =
  models.EscaneoOmrArchivado ?? model('EscaneoOmrArchivado', EscaneoOmrArchivadoSchema);

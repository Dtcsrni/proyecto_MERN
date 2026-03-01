/**
 * Modelo de examenes generados con variante y PDF asociado.
 */
import { Schema, model, models } from 'mongoose';

const ExamenGeneradoSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo' },
    plantillaId: { type: Schema.Types.ObjectId, ref: 'ExamenPlantilla', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno' },
    // Identificador de la corrida/lote de generación (mismo valor para lotes masivos).
    loteId: { type: String },
    folio: { type: String, required: true, unique: true },
    estado: { type: String, enum: ['generado', 'entregado', 'calificado'], default: 'generado' },
    entregadoEn: { type: Date },
    // Snapshot del set de preguntas (no necesariamente el orden); ayuda para regenerar PDFs sin re-muestrear.
    preguntasIds: [{ type: Schema.Types.ObjectId, ref: 'BancoPregunta' }],
    mapaVariante: { type: Schema.Types.Mixed, required: true },
    mapaOmr: { type: Schema.Types.Mixed },
    paginas: [{ numero: Number, qrTexto: String, preguntasDel: Number, preguntasAl: Number }],
    rutaPdf: { type: String },
    bookletArtifact: { type: Schema.Types.Mixed },
    omrSheetArtifact: { type: Schema.Types.Mixed },
    studentPacketArtifacts: { type: [Schema.Types.Mixed], default: [] },
    questionMap: { type: Schema.Types.Mixed },
    answerKeySet: { type: Schema.Types.Mixed },
    sheetInstances: { type: [Schema.Types.Mixed], default: [] },
    omrRuntimeVersion: { type: Number },
    generadoEn: { type: Date, default: Date.now },
    descargadoEn: { type: Date },
    archivadoEn: { type: Date }
  },
  { timestamps: true, collection: 'examenesGenerados' }
);

export const ExamenGenerado = models.ExamenGenerado ?? model('ExamenGenerado', ExamenGeneradoSchema);

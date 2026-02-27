import { Schema, model, models } from 'mongoose';

const EvidenciaEvaluacionSchema = new Schema(
  {
    docenteId: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    periodoId: { type: Schema.Types.ObjectId, ref: 'Periodo', required: true },
    alumnoId: { type: Schema.Types.ObjectId, ref: 'Alumno', required: true },
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    calificacionDecimal: { type: Number, required: true, min: 0, max: 10 },
    ponderacion: { type: Number, required: true, min: 0, default: 1 },
    fechaEvidencia: { type: Date, required: true },
    corte: { type: Number, enum: [1, 2, 3] },
    fuente: { type: String, enum: ['manual', 'classroom'], default: 'manual' },
    classroom: {
      courseId: { type: String },
      courseWorkId: { type: String },
      submissionId: { type: String },
      classroomUserId: { type: String },
      pulledAt: { type: Date }
    },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'evidenciasEvaluacion' }
);

EvidenciaEvaluacionSchema.index({ docenteId: 1, periodoId: 1, alumnoId: 1, fechaEvidencia: -1 });
EvidenciaEvaluacionSchema.index(
  { docenteId: 1, 'classroom.submissionId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'classroom.submissionId': { $type: 'string' }
    }
  }
);

export const EvidenciaEvaluacion =
  models.EvidenciaEvaluacion ?? model('EvidenciaEvaluacion', EvidenciaEvaluacionSchema);

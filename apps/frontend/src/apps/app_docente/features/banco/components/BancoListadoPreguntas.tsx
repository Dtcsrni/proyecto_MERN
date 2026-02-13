import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { idCortoMateria, obtenerVersionPregunta, preguntaTieneCodigo } from '../../../utilidades';
import type { Pregunta } from '../../../tipos';

export function BancoListadoPreguntas({
  periodoId,
  preguntasMateria,
  bloqueoEdicion,
  archivandoPreguntaId,
  puedeArchivar,
  iniciarEdicion,
  archivarPregunta
}: {
  periodoId: string;
  preguntasMateria: Pregunta[];
  bloqueoEdicion: boolean;
  archivandoPreguntaId: string | null;
  puedeArchivar: boolean;
  iniciarEdicion: (pregunta: Pregunta) => void;
  archivarPregunta: (preguntaId: string) => Promise<void>;
}) {
  return (
    <>
      <h3>Preguntas recientes{periodoId ? ` (${preguntasMateria.length})` : ''}</h3>
      <ul className="lista lista-items">
        {!periodoId && <li>Selecciona una materia para ver sus preguntas.</li>}
        {periodoId && preguntasMateria.length === 0 && <li>No hay preguntas en esta materia.</li>}
        {periodoId &&
          preguntasMateria.map((pregunta) => {
            const version = obtenerVersionPregunta(pregunta);
            const opcionesActuales = Array.isArray(version?.opciones) ? version?.opciones : [];
            const tieneCodigo = preguntaTieneCodigo(pregunta);
            return (
              <li key={pregunta._id}>
                <div className="item-glass">
                  <div className="item-row">
                    <div>
                      <div className="item-title">{version?.enunciado ?? 'Pregunta'}</div>
                      <div className="item-meta">
                        <span>ID: {idCortoMateria(pregunta._id)}</span>
                        <span>Tema: {pregunta.tema ? pregunta.tema : '-'}</span>
                        {tieneCodigo && (
                          <span className="badge" title="Se detecto codigo (inline/backticks, bloques o patrones tipicos)">
                            <span className="dot" /> Codigo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="item-actions revision-pills-wrap">
                      <Boton variante="secundario" type="button" onClick={() => iniciarEdicion(pregunta)} disabled={bloqueoEdicion}>
                        Editar
                      </Boton>
                      <Boton type="button" cargando={archivandoPreguntaId === pregunta._id} onClick={() => void archivarPregunta(pregunta._id)} disabled={!puedeArchivar}>
                        Archivar
                      </Boton>
                    </div>
                  </div>
                  {opcionesActuales.length === 5 && (
                    <ul className="item-options">
                      {opcionesActuales.map((op, idx) => (
                        <li key={idx} className={`item-option${op.esCorrecta ? ' item-option--correcta' : ''}`}>
                          <span className="item-option__letra">{String.fromCharCode(65 + idx)}.</span> {op.texto}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </>
  );
}

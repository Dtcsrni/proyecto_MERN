/**
 * PlantillasFormulario
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Icono } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { AyudaFormulario } from '../../../AyudaFormulario';
import { esMensajeError, etiquetaMateria, idCortoMateria } from '../../../utilidades';
import type { Periodo, Plantilla } from '../../../tipos';
import type { Dispatch, SetStateAction } from 'react';

type TemaDisponible = { tema: string; total: number };

export function PlantillasFormulario({
  modoEdicion,
  plantillaEditando,
  titulo,
  setTitulo,
  tipo,
  setTipo,
  periodoId,
  setPeriodoId,
  periodos,
  bloqueoEdicion,
  numeroPaginas,
  setNumeroPaginas,
  instrucciones,
  setInstrucciones,
  temasDisponibles,
  temasSeleccionados,
  setTemasSeleccionados,
  totalDisponiblePorTemas,
  creando,
  puedeCrear,
  crear,
  guardandoPlantilla,
  guardarEdicion,
  cancelarEdicion,
  mensaje
}: {
  modoEdicion: boolean;
  plantillaEditando: Plantilla | null;
  titulo: string;
  setTitulo: (value: string) => void;
  tipo: 'parcial' | 'global';
  setTipo: (value: 'parcial' | 'global') => void;
  periodoId: string;
  setPeriodoId: (value: string) => void;
  periodos: Periodo[];
  bloqueoEdicion: boolean;
  numeroPaginas: number;
  setNumeroPaginas: (value: number) => void;
  instrucciones: string;
  setInstrucciones: (value: string) => void;
  temasDisponibles: TemaDisponible[];
  temasSeleccionados: string[];
  setTemasSeleccionados: Dispatch<SetStateAction<string[]>>;
  totalDisponiblePorTemas: number;
  creando: boolean;
  puedeCrear: boolean;
  crear: () => void;
  guardandoPlantilla: boolean;
  guardarEdicion: () => Promise<void>;
  cancelarEdicion: () => void;
  mensaje: string;
}) {
  return (
    <div className="subpanel plantillas-panel plantillas-panel--form">
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> crear una plantilla de examen (estructura + reactivos) para generar examenes en PDF.
        </p>
        <ul className="lista">
          <li>
            <b>Titulo:</b> nombre descriptivo (ej. <code>Parcial 1 - Algebra</code>).
          </li>
          <li>
            <b>Tipo:</b> <code>parcial</code> o <code>global</code> (afecta campos de calificacion).
          </li>
          <li>
            <b>Materia:</b> la materia a la que pertenece.
          </li>
          <li>
            <b>Numero de paginas:</b> cuantas paginas debe tener el examen (entero mayor o igual a 1).
          </li>
          <li>
            <b>Temas:</b> selecciona uno o mas; el examen toma preguntas al azar de esos temas.
          </li>
        </ul>
        <p>
          Ejemplo: titulo <code>Parcial 1 - Programacion</code>, tipo <code>parcial</code>, paginas <code>2</code>, temas:{' '}
          <code>Arreglos</code> + <code>Funciones</code>.
        </p>
      </AyudaFormulario>
      <div className="ayuda plantillas-panel__hint">
        {modoEdicion && plantillaEditando ? (
          <>
            Editando: <b>{plantillaEditando.titulo}</b> (ID: {idCortoMateria(plantillaEditando._id)})
          </>
        ) : (
          'Crea plantillas por temas, o edita una existente.'
        )}
      </div>
      <div className="plantillas-form-wrap">
        <div className="plantillas-form">
          <label className="campo">
            Titulo
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              disabled={bloqueoEdicion}
              data-tooltip="Nombre visible de la plantilla."
            />
          </label>
          <label className="campo">
            Tipo
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as 'parcial' | 'global')}
              disabled={bloqueoEdicion}
              data-tooltip="Define si es parcial o global."
            >
              <option value="parcial">Parcial</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label className="campo">
            Materia
            <select
              value={periodoId}
              onChange={(event) => setPeriodoId(event.target.value)}
              disabled={bloqueoEdicion}
              data-tooltip="Materia a la que pertenece la plantilla."
            >
              <option value="">Selecciona</option>
              {periodos.map((periodo) => (
                <option key={periodo._id} value={periodo._id} title={periodo._id}>
                  {etiquetaMateria(periodo)}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Numero de paginas
            <input
              type="number"
              min={1}
              step={1}
              value={numeroPaginas}
              onChange={(event) => setNumeroPaginas(Number(event.target.value))}
              disabled={bloqueoEdicion}
              data-tooltip="Cantidad total de paginas del examen."
            />
          </label>

          <label className="campo plantillas-form__full">
            Instrucciones (opcional)
            <textarea
              value={instrucciones}
              onChange={(event) => setInstrucciones(event.target.value)}
              rows={3}
              disabled={bloqueoEdicion}
              data-tooltip="Texto opcional que aparece en el examen."
            />
          </label>
        </div>

        <div className="plantillas-temas">
          <div className="plantillas-temas__header">
            <h4>Temas</h4>
            <div className="plantillas-temas__stats">
              <span>Seleccionados: {temasSeleccionados.length}</span>
              <span>Disponibles: {temasDisponibles.length}</span>
            </div>
          </div>
          {periodoId && temasDisponibles.length === 0 && (
            <span className="ayuda">No hay temas para esta materia. Ve a &quot;Banco&quot; y crea preguntas con tema.</span>
          )}
          {temasDisponibles.length > 0 && (
            <div className="plantillas-temas__grid">
              {temasDisponibles.map((item) => {
                const checked = temasSeleccionados.some((t) => t.toLowerCase() === item.tema.toLowerCase());
                return (
                  <label key={item.tema} className={`plantillas-temas__chip${checked ? ' is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setTemasSeleccionados((prev) =>
                          checked ? prev.filter((t) => t.toLowerCase() !== item.tema.toLowerCase()) : [...prev, item.tema]
                        );
                      }}
                      disabled={bloqueoEdicion}
                      data-tooltip="Incluye este tema en la plantilla."
                    />
                    <span className="plantillas-temas__name">{item.tema}</span>
                    <span className="plantillas-temas__count">{item.total}</span>
                  </label>
                );
              })}
            </div>
          )}
          {temasSeleccionados.length > 0 && (
            <span className="ayuda">
              Total disponible en temas seleccionados: {totalDisponiblePorTemas}. Paginas solicitadas:{' '}
              {Math.max(1, Math.floor(numeroPaginas))}. Si faltan preguntas, el sistema avisara; solo bloqueara si la ultima pagina queda
              mas de la mitad vacia.
            </span>
          )}
        </div>
      </div>
      <div className="acciones acciones--mt">
        {!modoEdicion && (
          <Boton
            type="button"
            icono={<Icono nombre="nuevo" />}
            cargando={creando}
            disabled={!puedeCrear || bloqueoEdicion}
            onClick={crear}
            data-tooltip="Crea una nueva plantilla con los datos actuales."
          >
            {creando ? 'Creando…' : 'Crear plantilla'}
          </Boton>
        )}
        {modoEdicion && (
          <>
            <Boton
              type="button"
              cargando={guardandoPlantilla}
              disabled={!titulo.trim() || guardandoPlantilla || bloqueoEdicion}
              onClick={() => void guardarEdicion()}
              data-tooltip="Guarda los cambios en la plantilla."
            >
              {guardandoPlantilla ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={cancelarEdicion} data-tooltip="Cancela la edicion actual.">
              Cancelar
            </Boton>
          </>
        )}
      </div>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}

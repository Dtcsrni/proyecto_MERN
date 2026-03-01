/**
 * PlantillasListado
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import type { Periodo, Plantilla, PreviewPlantilla } from '../../../tipos';
import { etiquetaMateria, idCortoMateria } from '../../../utilidades';

type PlantillaPreviewState = Record<string, PreviewPlantilla>;
type PlantillaPreviewPdfState = Record<string, { booklet?: string; omrSheet?: string }>;

export function PlantillasListado({
  totalPlantillasTodas,
  totalPlantillas,
  filtroPlantillas,
  setFiltroPlantillas,
  plantillasFiltradas,
  periodos,
  previewPorPlantillaId,
  plantillaPreviewId,
  previewPdfUrlPorPlantillaId,
  cargandoPreviewPlantillaId,
  cargarPreviewPlantilla,
  puedePrevisualizarPlantillas,
  cargandoPreviewPdfPlantillaId,
  cargarPreviewPdfPlantilla,
  cerrarPreviewPdfPlantilla,
  abrirPdfFullscreen,
  pdfFullscreenUrl,
  cerrarPdfFullscreen,
  togglePreviewPlantilla,
  iniciarEdicion,
  puedeGestionarPlantillas,
  archivandoPlantillaId,
  archivarPlantilla,
  puedeArchivarPlantillas,
  formatearFechaHora
}: {
  totalPlantillasTodas: number;
  totalPlantillas: number;
  filtroPlantillas: string;
  setFiltroPlantillas: (value: string) => void;
  plantillasFiltradas: Plantilla[];
  periodos: Periodo[];
  previewPorPlantillaId: PlantillaPreviewState;
  plantillaPreviewId: string | null;
  previewPdfUrlPorPlantillaId: PlantillaPreviewPdfState;
  cargandoPreviewPlantillaId: string | null;
  cargarPreviewPlantilla: (plantillaId: string) => Promise<void>;
  puedePrevisualizarPlantillas: boolean;
  cargandoPreviewPdfPlantillaId: string | null;
  cargarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => Promise<void>;
  cerrarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => void;
  abrirPdfFullscreen: (url: string) => void;
  pdfFullscreenUrl: string | null;
  cerrarPdfFullscreen: () => void;
  togglePreviewPlantilla: (plantillaId: string) => Promise<void>;
  iniciarEdicion: (plantilla: Plantilla) => void;
  puedeGestionarPlantillas: boolean;
  archivandoPlantillaId: string | null;
  archivarPlantilla: (plantilla: Plantilla) => Promise<void>;
  puedeArchivarPlantillas: boolean;
  formatearFechaHora: (valor?: string) => string;
}) {
  return (
    <div className="subpanel plantillas-panel plantillas-panel--lista">
      <h3>Plantillas existentes</h3>
      <div className="plantillas-panel__meta">
        <span>Total: {totalPlantillasTodas}</span>
        <span>Mostradas: {totalPlantillas}</span>
      </div>
      <div className="plantillas-filtro">
        <label className="campo plantillas-filtro__campo">
          Buscar
          <input
            value={filtroPlantillas}
            onChange={(e) => setFiltroPlantillas(e.target.value)}
            placeholder="Titulo, tema o ID…"
            data-tooltip="Filtra por titulo, tema o ID."
          />
        </label>
        <div className="plantillas-filtro__resultado">
          {filtroPlantillas.trim() ? `Filtro: "${filtroPlantillas.trim()}"` : 'Sin filtros aplicados'}
        </div>
      </div>
      {plantillasFiltradas.length === 0 ? (
        <InlineMensaje tipo="info">No hay plantillas con ese filtro. Ajusta la busqueda o crea una nueva.</InlineMensaje>
      ) : (
        <ul className="lista lista-items plantillas-lista">
          {plantillasFiltradas.map((plantilla) => {
            const materia = periodos.find((p) => p._id === plantilla.periodoId);
            const temas = Array.isArray(plantilla.temas) ? plantilla.temas : [];
            const modo = temas.length > 0 ? `Temas: ${temas.join(', ')}` : 'Modo preguntasIds';
            const preview = previewPorPlantillaId[plantilla._id];
            const previewAbierta = plantillaPreviewId === plantilla._id;
            const pdfUrls = previewPdfUrlPorPlantillaId[plantilla._id] ?? {};
            const bookletPdfUrl = pdfUrls.booklet;
            const omrPdfUrl = pdfUrls.omrSheet;
            return (
              <li key={plantilla._id}>
                <div className="item-glass plantillas-item">
                  <div className="item-row">
                    <div>
                      <div className="item-title">{plantilla.titulo}</div>
                      <div className="item-meta">
                        <span>ID: {idCortoMateria(plantilla._id)}</span>
                        <span>Tipo: {plantilla.tipo}</span>
                        <span>Paginas: {Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 0) || '-'}</span>
                        <span>Creada: {formatearFechaHora(plantilla.createdAt)}</span>
                        <span>Materia: {materia ? etiquetaMateria(materia) : '-'}</span>
                      </div>
                      <div className="item-sub plantillas-item__sub">{modo}</div>
                      {temas.length > 0 && (
                        <div className="plantillas-item__temas">
                          {temas.map((tema) => (
                            <span key={`${plantilla._id}-${tema}`} className="badge plantillas-item__tema-badge">
                              {tema}
                            </span>
                          ))}
                        </div>
                      )}
                      {previewAbierta && (
                        <div className="resultado plantillas-preview">
                          <h4 className="plantillas-preview__titulo">Previsualizacion OMR V1</h4>
                          {!preview && (
                            <div className="ayuda">
                              Esta previsualizacion separa el cuadernillo de la hoja OMR y expone diagnosticos de densidad, capacidad y lectura.
                            </div>
                          )}
                          {!preview && (
                            <Boton
                              type="button"
                              variante="secundario"
                              cargando={cargandoPreviewPlantillaId === plantilla._id}
                              onClick={() => void cargarPreviewPlantilla(plantilla._id)}
                              disabled={!puedePrevisualizarPlantillas}
                              data-tooltip="Genera el preview dual de cuadernillo y hoja OMR."
                            >
                              {cargandoPreviewPlantillaId === plantilla._id ? 'Generando…' : 'Generar previsualizacion'}
                            </Boton>
                          )}
                          {preview && (
                            <>
                              {preview.blockingIssues.length > 0 && (
                                <InlineMensaje tipo="error">{preview.blockingIssues.join(' ')}</InlineMensaje>
                              )}
                              {preview.warnings.length > 0 && (
                                <InlineMensaje tipo="info">{preview.warnings.join(' ')}</InlineMensaje>
                              )}
                              <div className="plantillas-preview__grid">
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Cuadernillo</h4>
                                  <ul className="lista">
                                    <li>
                                      <b>Paginas objetivo:</b> {preview.bookletPreview.pagesConfigured}
                                    </li>
                                    <li>
                                      <b>Paginas estimadas:</b> {preview.bookletPreview.pagesEstimated}
                                    </li>
                                    <li>
                                      <b>Distribucion:</b> {preview.bookletPreview.questionsPerPage.join(' / ') || '-'}
                                    </li>
                                    <li>
                                      <b>Reactivos con imagen:</b> {preview.bookletPreview.imageHeavyQuestions.length}
                                    </li>
                                  </ul>
                                </div>
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Hoja OMR</h4>
                                  <ul className="lista">
                                    <li>
                                      <b>Familia:</b> {preview.omrSheetPreview.familyCode}
                                    </li>
                                    <li>
                                      <b>Capacidad:</b> {preview.omrSheetPreview.questionCapacity}
                                    </li>
                                    <li>
                                      <b>Usadas:</b> {preview.omrSheetPreview.questionsUsed}
                                    </li>
                                    <li>
                                      <b>Ignoradas:</b> {preview.omrSheetPreview.unusedQuestionsIgnored}
                                    </li>
                                  </ul>
                                </div>
                              </div>
                              <div className="resultado plantillas-preview__bloque">
                                <h4 className="plantillas-preview__subtitulo">Diagnostico</h4>
                                <div className="item-meta">
                                  <span>Densidad cuadernillo: {(preview.diagnostics.bookletDensityScore * 100).toFixed(0)}%</span>
                                  <span>Legibilidad OMR: {(preview.diagnostics.omrReadabilityScore * 100).toFixed(0)}%</span>
                                  <span>Huella anclas: {(preview.diagnostics.anchorFootprintRatio * 100).toFixed(2)}%</span>
                                  <span>Huella QR: {(preview.diagnostics.qrFootprintRatio * 100).toFixed(2)}%</span>
                                </div>
                                {preview.diagnostics.pagesWithLowDensity.length > 0 && (
                                  <div className="ayuda">
                                    Paginas con baja densidad: {preview.diagnostics.pagesWithLowDensity.join(', ')}.
                                  </div>
                                )}
                                {preview.diagnostics.hardLayoutWarnings.length > 0 && (
                                  <InlineMensaje tipo="error">{preview.diagnostics.hardLayoutWarnings.join(' ')}</InlineMensaje>
                                )}
                              </div>
                              <div className="acciones acciones--mt">
                                {!bookletPdfUrl ? (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                                    onClick={() => void cargarPreviewPdfPlantilla(plantilla._id, 'booklet')}
                                    disabled={!puedePrevisualizarPlantillas}
                                    data-tooltip="Genera el PDF del cuadernillo."
                                  >
                                    {cargandoPreviewPdfPlantillaId === plantilla._id ? 'Generando PDF…' : 'Ver cuadernillo'}
                                  </Boton>
                                ) : (
                                  <>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => cerrarPreviewPdfPlantilla(plantilla._id, 'booklet')}
                                      data-tooltip="Oculta el cuadernillo."
                                    >
                                      Ocultar cuadernillo
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => abrirPdfFullscreen(bookletPdfUrl)}
                                      data-tooltip="Abre el cuadernillo en pantalla completa."
                                    >
                                      Ver cuadernillo
                                    </Boton>
                                  </>
                                )}
                                {!omrPdfUrl ? (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                                    onClick={() => void cargarPreviewPdfPlantilla(plantilla._id, 'omrSheet')}
                                    disabled={!puedePrevisualizarPlantillas}
                                    data-tooltip="Genera el PDF de hoja OMR."
                                  >
                                    {cargandoPreviewPdfPlantillaId === plantilla._id ? 'Generando PDF…' : 'Ver hoja OMR'}
                                  </Boton>
                                ) : (
                                  <>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => cerrarPreviewPdfPlantilla(plantilla._id, 'omrSheet')}
                                      data-tooltip="Oculta la hoja OMR."
                                    >
                                      Ocultar hoja OMR
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => abrirPdfFullscreen(omrPdfUrl)}
                                      data-tooltip="Abre la hoja OMR en pantalla completa."
                                    >
                                      Ver hoja OMR
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => {
                                        const u = String(omrPdfUrl || '').trim();
                                        if (!u) return;
                                        window.open(u, '_blank', 'noopener,noreferrer');
                                      }}
                                      data-tooltip="Abre la hoja OMR en una pestaña nueva."
                                    >
                                      Abrir en pestaña
                                    </Boton>
                                  </>
                                )}
                              </div>
                              {bookletPdfUrl && (
                                <div className="plantillas-preview__pdfWrap">
                                  <iframe className="plantillas-preview__pdf" title="Previsualizacion cuadernillo" src={bookletPdfUrl} />
                                </div>
                              )}
                              {omrPdfUrl && (
                                <div className="plantillas-preview__pdfWrap">
                                  <iframe className="plantillas-preview__pdf" title="Previsualizacion hoja OMR" src={omrPdfUrl} />
                                </div>
                              )}
                              {pdfFullscreenUrl && (
                                <div className="pdf-overlay" role="dialog" aria-modal="true">
                                  <div className="pdf-overlay__bar">
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={cerrarPdfFullscreen}
                                      data-tooltip="Cierra la vista de PDF a pantalla completa."
                                    >
                                      Cerrar
                                    </Boton>
                                  </div>
                                  <iframe className="pdf-overlay__frame" title="PDF (pantalla completa)" src={pdfFullscreenUrl} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="item-actions plantillas-item__actions">
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={cargandoPreviewPlantillaId === plantilla._id}
                        onClick={() => void togglePreviewPlantilla(plantilla._id)}
                        disabled={!puedePrevisualizarPlantillas}
                        data-tooltip="Muestra u oculta la previsualizacion."
                      >
                        {previewAbierta ? 'Ocultar previsualizacion' : 'Previsualizar'}
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        onClick={() => iniciarEdicion(plantilla)}
                        disabled={!puedeGestionarPlantillas}
                        data-tooltip="Edita esta plantilla."
                      >
                        Editar
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={archivandoPlantillaId === plantilla._id}
                        onClick={() => void archivarPlantilla(plantilla)}
                        disabled={!puedeArchivarPlantillas}
                        data-tooltip="Elimina la plantilla con confirmacion previa."
                      >
                        Eliminar
                      </Boton>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

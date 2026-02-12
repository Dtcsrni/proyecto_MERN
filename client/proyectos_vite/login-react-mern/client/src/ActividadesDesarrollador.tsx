/**
 * [BLOQUE DIDACTICO] client/src/ActividadesDesarrollador.tsx
 * Que es: panel de actividades ejecutables para roles tecnicos.
 * Que hace: consulta el inventario de cuentas y genera un PDF descargable.
 * Como lo hace: pide datos al endpoint resumen y los renderiza con jsPDF en formato tabular.
 */

import { useState } from "react";
import { jsPDF } from "jspdf";
import { consultarApi } from "./api";
import { useAutenticacion } from "./useAutenticacion";
import type { Rol } from "./authTipos";

type CuentaExportable = {
  // Texto principal de la fila; puede ser largo y por eso se trunca al imprimir.
  correo: string;
  // Se imprime como literal para que el reporte sea audit-able tal cual se guarda en DB.
  rol: string;
  // Se transforma a "Si/No" para que el PDF sea legible para perfiles no técnicos.
  activo: boolean;
  // Fecha opcional para soportar datos legacy o incompletos.
  createdAt?: string;
};

// Contrato exacto esperado del endpoint de resumen de cuentas.
type RespuestaCuentas = {
  cuentas: CuentaExportable[];
  total?: number;
};

// Mensajes de feedback visibles en UI.
type EstadoMensaje = {
  tipo: "ok" | "error";
  texto: string;
};

// Metadatos de columna para imprimir una fila en coordenadas fijas del PDF.
type ColumnaTabla = {
  // Titulo visible en cabecera.
  titulo: string;
  // Posicion horizontal fija en puntos PDF.
  x: number;
  // Funcion que extrae/formatea el valor de la columna para una cuenta.
  valor: (cuenta: CuentaExportable) => string;
};

// Se fija formato para todo el documento y evitar fechas inconsistentes entre filas.
const FORMATO_FECHA = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
// Roles que pueden ejecutar exportaciones manuales desde la UI.
const ROLES_CON_EXPORTACION: Rol[] = ["desarrollador", "administrador", "super_usuario"];

// Convierte ISO a fecha legible y evita romper render si la fecha no existe.
function formatearFecha(iso?: string): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleDateString("es-ES", FORMATO_FECHA);
}

// Acota texto para no desbordar celdas en la tabla del PDF.
function truncar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, Math.max(0, maximo - 1))}…`;
}

/**
 * Construye el PDF en memoria y dispara la descarga.
 * Incluye salto de pagina y reimpresion de encabezados de tabla.
 *
 * Estrategia:
 * 1) Configurar lienzo (A4 en puntos) y metrica de layout.
 * 2) Imprimir encabezado institucional + metadata del lote.
 * 3) Renderizar tabla por filas con control de salto de pagina.
 * 4) Descargar con nombre versionado por fecha.
 */
function construirPdf(cuentas: CuentaExportable[], total: number): void {
  // Unidad "pt" (points) facilita razonar el layout tipografico (1/72 inch).
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  // Margen uniforme para que encabezado y tabla respiren igual en todas las páginas.
  const margen = 40;
  // El ancho se usa para dibujar la linea horizontal del header de tabla.
  const anchoPagina = doc.internal.pageSize.getWidth();
  // Limite Y para saber cuándo ya no cabe una fila y forzar nueva página.
  const limiteInferior = doc.internal.pageSize.getHeight() - margen;
  // Alto fijo de fila para simplificar el cálculo de paginación.
  const altoFila = 14;
  // Cursor vertical mutable compartido por todo el proceso de impresión.
  let y = margen;

  // "Plantilla" de columnas: permite agregar/quitar columnas sin tocar el loop principal.
  const columnas: ColumnaTabla[] = [
    { titulo: "Correo", x: margen, valor: (cuenta) => truncar(cuenta.correo, 48) },
    { titulo: "Rol", x: margen + 270, valor: (cuenta) => cuenta.rol },
    { titulo: "Activo", x: margen + 370, valor: (cuenta) => (cuenta.activo ? "Sí" : "No") },
    { titulo: "Registro", x: margen + 440, valor: (cuenta) => formatearFecha(cuenta.createdAt) }
  ];

  // Encabezado general del documento.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relación de cuentas existentes", margen, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  // Se usa fecha actual para trazabilidad de cuándo se emitió el reporte.
  doc.text(`Generado: ${formatearFecha(new Date().toISOString())}`, margen, y);
  y += 16;
  // Se imprime total explícito para validación manual del lote exportado.
  doc.text(`Total de cuentas: ${total}`, margen, y);
  y += 20;

  // Encabezado de tabla reutilizable: se dibuja al iniciar y en cada salto de página.
  const imprimirEncabezadoTabla = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    columnas.forEach((columna) => doc.text(columna.titulo, columna.x, y));
    y += 12;
    doc.setLineWidth(0.5);
    doc.line(margen, y, anchoPagina - margen, y);
    y += 12;
    doc.setFont("helvetica", "normal");
  };

  imprimirEncabezadoTabla();

  for (const cuenta of cuentas) {
    // Si no cabe otra fila, creamos página nueva y repetimos el encabezado de la tabla.
    if (y > limiteInferior - altoFila) {
      doc.addPage();
      // Reiniciamos cursor al margen superior para la nueva hoja.
      y = margen;
      imprimirEncabezadoTabla();
    }

    // Todas las celdas de una misma cuenta se imprimen en la misma coordenada Y.
    columnas.forEach((columna) => doc.text(columna.valor(cuenta), columna.x, y));
    y += altoFila;
  }

  // Convención de nombre: prefijo funcional + fecha ISO corta (YYYY-MM-DD).
  doc.save(`cuentas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function ActividadesDesarrollador() {
  const { usuario } = useAutenticacion();
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<EstadoMensaje | null>(null);

  // La actividad ni siquiera se muestra si el rol no esta habilitado.
  if (!usuario || !ROLES_CON_EXPORTACION.includes(usuario.rol)) return null;

  // Caso de uso completo de exportacion: pedir datos -> construir PDF -> notificar resultado.
  async function exportarPdf() {
    // Estado de carga para bloquear doble clic y evitar descargas duplicadas.
    setExportando(true);
    setMensaje(null);

    try {
      // Paso 1: obtenemos cuentas desde backend.
      const respuesta = await consultarApi<RespuestaCuentas>("/api/auth/usuarios/resumen");
      // Si no hay datos, devolvemos feedback positivo sin crear archivo vacío.
      if (!respuesta.cuentas.length) {
        setMensaje({ tipo: "ok", texto: "No hay cuentas disponibles para exportar." });
        return;
      }

      // Paso 2: generamos y descargamos el PDF.
      construirPdf(respuesta.cuentas, respuesta.total ?? respuesta.cuentas.length);
      setMensaje({ tipo: "ok", texto: "PDF generado y descargado." });
    } catch (errorDesconocido: unknown) {
      // Cualquier fallo (red, permisos o parsing) se traduce a mensaje legible.
      const texto =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No se pudo exportar la relación de cuentas.";
      setMensaje({ tipo: "error", texto });
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="panel">
      <h2>Actividades ejecutables (Desarrollador)</h2>
      <p>Exporta una relación de cuentas existentes en formato PDF.</p>
      <div className="actions">
        <button type="button" onClick={() => void exportarPdf()} disabled={exportando}>
          {exportando ? "Generando PDF..." : "Exportar cuentas (PDF)"}
        </button>
      </div>
      {mensaje && (
        <p className={mensaje.tipo === "error" ? "error-message" : "success-message"}>{mensaje.texto}</p>
      )}
    </section>
  );
}

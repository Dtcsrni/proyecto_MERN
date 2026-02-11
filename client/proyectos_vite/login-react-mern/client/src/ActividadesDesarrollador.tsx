/**
 * [BLOQUE DIDACTICO] client/src/ActividadesDesarrollador.tsx
 * Que es: panel para tareas exclusivas del rol desarrollador.
 * Que hace: solicita un resumen de cuentas al backend y lo exporta a PDF.
 * Como lo hace: consulta API + construye una tabla paginada usando jsPDF.
 */

import { useState } from "react";
import { jsPDF } from "jspdf";
import { consultarApi } from "./api";
import { useAutenticacion } from "./useAutenticacion";
import type { Rol } from "./authTipos";

type CuentaExportable = {
  correo: string;
  rol: string;
  activo: boolean;
  createdAt?: string;
};

type RespuestaCuentas = {
  cuentas: CuentaExportable[];
  total?: number;
};

type EstadoMensaje = {
  tipo: "ok" | "error";
  texto: string;
};

type ColumnaTabla = {
  titulo: string;
  x: number;
  valor: (cuenta: CuentaExportable) => string;
};

const FORMATO_FECHA = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
const ROLES_CON_EXPORTACION: Rol[] = ["desarrollador", "administrador", "super_usuario"];

function formatearFecha(iso?: string): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleDateString("es-ES", FORMATO_FECHA);
}

function truncar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, Math.max(0, maximo - 1))}…`;
}

function construirPdf(cuentas: CuentaExportable[], total: number): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margen = 40;
  const anchoPagina = doc.internal.pageSize.getWidth();
  const limiteInferior = doc.internal.pageSize.getHeight() - margen;
  const altoFila = 14;
  let y = margen;

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
  doc.text(`Generado: ${formatearFecha(new Date().toISOString())}`, margen, y);
  y += 16;
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
      y = margen;
      imprimirEncabezadoTabla();
    }

    columnas.forEach((columna) => doc.text(columna.valor(cuenta), columna.x, y));
    y += altoFila;
  }

  doc.save(`cuentas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function ActividadesDesarrollador() {
  const { usuario } = useAutenticacion();
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<EstadoMensaje | null>(null);

  if (!usuario || !ROLES_CON_EXPORTACION.includes(usuario.rol)) return null;

  async function exportarPdf() {
    setExportando(true);
    setMensaje(null);

    try {
      // Paso 1: obtenemos cuentas desde backend.
      const respuesta = await consultarApi<RespuestaCuentas>("/api/auth/usuarios/resumen");
      if (!respuesta.cuentas.length) {
        setMensaje({ tipo: "ok", texto: "No hay cuentas disponibles para exportar." });
        return;
      }

      // Paso 2: generamos y descargamos el PDF.
      construirPdf(respuesta.cuentas, respuesta.total ?? respuesta.cuentas.length);
      setMensaje({ tipo: "ok", texto: "PDF generado y descargado." });
    } catch (errorDesconocido: unknown) {
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

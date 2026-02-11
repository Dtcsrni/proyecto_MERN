/**
 * [BLOQUE DIDACTICO] client/src/ActividadesDesarrollador.tsx
 * Que es: Panel de actividades ejecutables para rol desarrollador.
 * Que hace: Exporta la relación de cuentas existentes a un PDF.
 * Como lo hace: Consulta el backend y genera PDF con jsPDF.
 */

import { useState } from "react";
import { jsPDF } from "jspdf";
import { consultarApi } from "./api";
import { useAutenticacion } from "./useAutenticacion";

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

function formatearFecha(iso?: string): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, Math.max(0, max - 1))}…`;
}

function construirPdf(cuentas: CuentaExportable[], total: number) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margen = 40;
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const limiteInferior = alto - margen;
  const colCorreo = margen;
  const colRol = margen + 270;
  const colActivo = margen + 370;
  const colRegistro = margen + 440;
  let y = margen;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relación de cuentas existentes", margen, y);
  y += 22;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado: ${formatearFecha(new Date().toISOString())}`, margen, y);
  y += 16;
  doc.text(`Total de cuentas: ${total}`, margen, y);
  y += 20;

  const imprimirEncabezadoTabla = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Correo", colCorreo, y);
    doc.text("Rol", colRol, y);
    doc.text("Activo", colActivo, y);
    doc.text("Registro", colRegistro, y);
    y += 12;
    doc.setLineWidth(0.5);
    doc.line(margen, y, ancho - margen, y);
    y += 12;
    doc.setFont("helvetica", "normal");
  };

  imprimirEncabezadoTabla();

  cuentas.forEach((cuenta) => {
    if (y > limiteInferior - 14) {
      doc.addPage();
      y = margen;
      imprimirEncabezadoTabla();
    }

    doc.text(truncar(cuenta.correo, 48), colCorreo, y);
    doc.text(cuenta.rol, colRol, y);
    doc.text(cuenta.activo ? "Sí" : "No", colActivo, y);
    doc.text(formatearFecha(cuenta.createdAt), colRegistro, y);
    y += 14;
  });

  doc.save(`cuentas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function ActividadesDesarrollador() {
  const { usuario } = useAutenticacion();
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeExportar = usuario?.rol === "desarrollador";

  if (!puedeExportar) return null;

  async function exportarPdf() {
    setExportando(true);
    setError(null);
    setAviso(null);

    try {
      const respuesta = await consultarApi<RespuestaCuentas>("/api/auth/usuarios/resumen");
      if (!respuesta.cuentas.length) {
        setAviso("No hay cuentas disponibles para exportar.");
        return;
      }

      construirPdf(respuesta.cuentas, respuesta.total ?? respuesta.cuentas.length);
      setAviso("PDF generado y descargado.");
    } catch (errorDesconocido: unknown) {
      const mensaje =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No se pudo exportar la relación de cuentas.";
      setError(mensaje);
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
      {error && <p className="error-message">{error}</p>}
      {aviso && <p className="success-message">{aviso}</p>}
    </section>
  );
}

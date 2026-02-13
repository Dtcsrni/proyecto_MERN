/**
 * Endpoint de salud para monitoreo de API y base de datos.
 */
import { Router } from 'express';
import mongoose from 'mongoose';
import os from 'node:os';
import QRCode from 'qrcode';
import type { RespuestaLiveness, RespuestaReadiness, RespuestaSalud } from '../tipos/observabilidad';
import { exportarMetricasPrometheus } from '../observabilidad/metrics';

const router = Router();

router.get('/', (_req, res) => {
  const estado = mongoose.connection.readyState; // 0,1,2,3
  const textoEstado = ['desconectado', 'conectado', 'conectando', 'desconectando'][estado] ?? 'desconocido';
  const payload: RespuestaSalud & { db: { estado: number; descripcion: string } } = {
    estado: 'ok',
    tiempoActivo: process.uptime(),
    db: { estado, descripcion: textoEstado }
  };
  res.json(payload);
});

router.get('/live', (_req, res) => {
  const payload: RespuestaLiveness = {
    estado: 'ok',
    tiempoActivo: process.uptime(),
    servicio: 'api-docente',
    env: process.env.NODE_ENV ?? 'development'
  };
  res.json(payload);
});

router.get('/ready', (_req, res) => {
  const estado = mongoose.connection.readyState; // 0,1,2,3
  const textoEstado = ['desconectado', 'conectado', 'conectando', 'desconectando'][estado] ?? 'desconocido';
  const lista = estado === 1;
  const payload: RespuestaReadiness = {
    estado: lista ? 'ok' : 'degradado',
    tiempoActivo: process.uptime(),
    dependencias: {
      db: {
        estado,
        descripcion: textoEstado,
        lista
      }
    }
  };
  res.status(lista ? 200 : 503).json(payload);
});

router.get('/metrics', (_req, res) => {
  const estadoDb = mongoose.connection.readyState;
  const payload = `${exportarMetricasPrometheus()}\n\n# HELP evaluapro_db_ready_state Estado de conexión MongoDB (0-3)\n# TYPE evaluapro_db_ready_state gauge\nevaluapro_db_ready_state ${estadoDb}\n`;
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(payload);
});

function esIpPrivada(ip: string) {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const seg = Number(ip.split('.')[1] ?? -1);
    return seg >= 16 && seg <= 31;
  }
  return false;
}

function obtenerIpsLocales() {
  const hostEnv = String(process.env.HOST_IP || '').trim();
  const hostIp = /^[0-9.]+$/.test(hostEnv) ? hostEnv : '';
  const redes = os.networkInterfaces();
  const ips: string[] = [];
  for (const entradas of Object.values(redes)) {
    for (const item of entradas ?? []) {
      if (!item || item.internal) continue;
      if (item.family !== 'IPv4') continue;
      ips.push(item.address);
    }
  }
  const unicas = Array.from(new Set(ips));
  if (hostIp && !unicas.includes(hostIp)) {
    unicas.unshift(hostIp);
  }
  const privadas = unicas.filter((ip) => esIpPrivada(ip));
  const publicas = unicas.filter((ip) => !esIpPrivada(ip));
  const preferida = hostIp || privadas[0] || publicas[0] || null;
  return { ips: [...privadas, ...publicas], preferida };
}

router.get('/ip-local', (_req, res) => {
  res.json(obtenerIpsLocales());
});

router.get('/qr', async (req, res) => {
  const texto = typeof req.query.texto === 'string' ? req.query.texto.trim() : '';
  if (!texto) {
    res.status(400).json({ error: { codigo: 'QR_TEXTO_VACIO', mensaje: 'texto requerido' } });
    return;
  }
  try {
    const buffer = await QRCode.toBuffer(texto, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: { codigo: 'QR_FALLO', mensaje: error instanceof Error ? error.message : 'Error' } });
  }
});

export default router;

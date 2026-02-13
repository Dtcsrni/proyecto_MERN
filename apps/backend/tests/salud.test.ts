// Pruebas del endpoint de salud.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';

describe('salud', () => {
  it('responde con estado ok y metadata de DB', async () => {
    const app = crearApp();
    const respuesta = await request(app).get('/api/salud').expect(200);

    expect(respuesta.body.estado).toBe('ok');
    expect(respuesta.body.db).toEqual(
      expect.objectContaining({
        estado: expect.any(Number)
      })
    );
  });

  it('expone liveness y readiness', async () => {
    const app = crearApp();
    const live = await request(app).get('/api/salud/live').expect(200);
    expect(live.body).toEqual(
      expect.objectContaining({
        estado: 'ok',
        servicio: 'api-docente'
      })
    );

    const ready = await request(app).get('/api/salud/ready');
    expect([200, 503]).toContain(ready.status);
    expect(ready.body).toEqual(
      expect.objectContaining({
        dependencias: expect.objectContaining({
          db: expect.objectContaining({
            estado: expect.any(Number),
            lista: expect.any(Boolean)
          })
        })
      })
    );
  });

  it('expone métricas en formato texto', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/salud/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(String(res.text)).toContain('evaluapro_http_requests_total');
    expect(String(res.text)).toContain('evaluapro_db_ready_state');
  });

  it('expone alias de métricas en /api/metrics', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/metrics').expect(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/plain');
    expect(String(res.text)).toContain('evaluapro_http_requests_total');
  });
});


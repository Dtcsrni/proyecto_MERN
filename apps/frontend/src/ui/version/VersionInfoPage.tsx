import { useEffect, useMemo, useState } from 'react';
import { obtenerVersionApp } from './versionInfo';

type VersionInfoPayload = {
  app?: { name?: string; version?: string };
  system?: {
    node?: string;
    platform?: string;
    arch?: string;
    hostname?: string;
    env?: string;
    uptimeSec?: number;
    generatedAt?: string;
  };
  developer?: { nombre?: string; rol?: string };
  changelog?: string;
};

function leerPortalDesdeHash() {
  try {
    const hash = String(window.location.hash || '');
    const idx = hash.indexOf('?');
    if (idx < 0) return 'docente';
    const search = new URLSearchParams(hash.slice(idx + 1));
    const portal = String(search.get('portal') || '').toLowerCase();
    return portal === 'alumno' ? 'alumno' : 'docente';
  } catch {
    return 'docente';
  }
}

export function VersionInfoPage() {
  const [data, setData] = useState<VersionInfoPayload | null>(null);
  const [error, setError] = useState('');
  const portal = useMemo(() => leerPortalDesdeHash(), []);
  const fallbackVersion = obtenerVersionApp();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/salud/version-info', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelado) setData(json);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar version-info');
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const version = String(data?.app?.version || fallbackVersion || '0.0.0');
  const nombre = String(data?.app?.name || 'evaluapro');
  const developer = String(data?.developer?.nombre || import.meta.env.VITE_DEVELOPER_NAME || 'Equipo EvaluaPro');
  const rol = String(data?.developer?.rol || import.meta.env.VITE_DEVELOPER_ROLE || 'Desarrollo');
  const changelog = String(data?.changelog || 'Sin changelog disponible.');

  return (
    <main className="version-page">
      <section className="version-hero">
        <p className="version-eyebrow">EvaluaPro · {portal === 'alumno' ? 'Portal Alumno' : 'Portal Docente'}</p>
        <h1>Version Center</h1>
        <p className="version-sub">
          <span className="version-pulse" /> {nombre} v{version}
        </p>
      </section>

      <section className="version-grid">
        <article className="version-card">
          <h2>Sistema</h2>
          <p><strong>Node:</strong> {String(data?.system?.node || '-')}</p>
          <p><strong>Plataforma:</strong> {String(data?.system?.platform || '-')} / {String(data?.system?.arch || '-')}</p>
          <p><strong>Host:</strong> {String(data?.system?.hostname || '-')}</p>
          <p><strong>Entorno:</strong> {String(data?.system?.env || '-')}</p>
        </article>
        <article className="version-card">
          <h2>Desarrollador</h2>
          <p><strong>Nombre:</strong> {developer}</p>
          <p><strong>Rol:</strong> {rol}</p>
          <p><strong>Generado:</strong> {String(data?.system?.generatedAt || new Date().toISOString())}</p>
        </article>
      </section>

      <section className="version-card version-card-wide">
        <h2>Changelog</h2>
        {error ? <p className="version-error">{error}</p> : null}
        <pre className="version-changelog">{changelog}</pre>
      </section>
    </main>
  );
}

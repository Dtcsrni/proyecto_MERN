export type NivelLogEstandar = 'debug' | 'info' | 'warn' | 'error';

export type ContextoLog = {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  errorCode?: string;
  [k: string]: unknown;
};

export type RespuestaSalud = {
  estado: 'ok' | 'degradado';
  tiempoActivo: number;
};

export type RespuestaLiveness = RespuestaSalud & {
  servicio: string;
  env: string;
};

export type RespuestaReadiness = RespuestaSalud & {
  dependencias: {
    db: {
      estado: number;
      descripcion: string;
      lista: boolean;
    };
  };
};

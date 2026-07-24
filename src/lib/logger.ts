/**
 * Logger fino da LuxCar.
 *
 * Centraliza logs para que, no futuro, seja trivial plugar um coletor
 * (Sentry, Logflare, etc.) sem caçar `console.*` espalhado. Em produção,
 * silencia `debug`/`info` e mantém apenas `warn`/`error`.
 *
 * Aditivo: não substitui nada hoje. Serviços novos devem preferir este logger
 * a `console.*` direto.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

function emit(level: LogLevel, scope: string, message: string, meta?: unknown) {
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const prefix = `[luxcar:${scope}]`;
  // Mantém stack/contexto no console do dev; em prod, ponto único p/ futuro coletor.
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(prefix, message, meta);
  else fn(prefix, message);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => emit('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => emit('error', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;

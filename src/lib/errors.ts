/**
 * Tratamento de erro centralizado da LuxCar.
 *
 * Objetivo: nunca vazar detalhe técnico do Supabase/Postgres para a interface,
 * mas preservar o detalhe real para log/diagnóstico. A camada de UI deve exibir
 * `error.userMessage`; o log usa `error.cause` / `error.technical`.
 *
 * Este módulo é aditivo e não altera contratos existentes. Serviços novos o usam;
 * chamadas legadas (páginas) podem migrar gradualmente.
 */

export type AppErrorKind =
  | 'auth'          // não autenticado
  | 'forbidden'     // autenticado, sem permissão / fora do tenant
  | 'validation'    // entrada inválida
  | 'not_found'     // recurso inexistente
  | 'conflict'      // violação de regra de negócio / constraint
  | 'network'       // falha de rede / indisponibilidade
  | 'unknown';      // não classificado

const DEFAULT_USER_MESSAGE: Record<AppErrorKind, string> = {
  auth: 'Sua sessão expirou. Faça login novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  validation: 'Verifique os dados informados e tente novamente.',
  not_found: 'Registro não encontrado.',
  conflict: 'Não foi possível concluir: esta ação conflita com dados existentes.',
  network: 'Falha de conexão. Verifique sua internet e tente novamente.',
  unknown: 'Algo deu errado. Tente novamente em instantes.',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Mensagem segura, pronta para exibir ao usuário final. */
  readonly userMessage: string;
  /** Detalhe técnico original (nunca exibir na UI). */
  readonly technical?: string;
  /** Erro/estrutura original que originou este AppError. */
  readonly cause?: unknown;

  constructor(
    kind: AppErrorKind,
    opts?: { userMessage?: string; technical?: string; cause?: unknown }
  ) {
    super(opts?.technical || opts?.userMessage || DEFAULT_USER_MESSAGE[kind]);
    this.name = 'AppError';
    this.kind = kind;
    this.userMessage = opts?.userMessage || DEFAULT_USER_MESSAGE[kind];
    this.technical = opts?.technical;
    this.cause = opts?.cause;
  }
}

/**
 * Mapeia um erro do Supabase (PostgrestError / AuthError / genérico) para AppError.
 * Não lança — retorna sempre um AppError classificado.
 */
export function normalizeSupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const e = error as { code?: string; message?: string; status?: number; details?: string } | null;
  const code = e?.code;
  const message = e?.message;
  const status = e?.status;

  // Sem linha em .single() → PGRST116
  if (code === 'PGRST116') {
    return new AppError('not_found', { technical: message, cause: error });
  }
  // Violações de constraint do Postgres
  if (code === '23505') {
    return new AppError('conflict', {
      userMessage: 'Já existe um registro com esses dados.',
      technical: message,
      cause: error,
    });
  }
  if (code === '23503') {
    return new AppError('conflict', {
      userMessage: 'Não é possível concluir: existem registros vinculados.',
      technical: message,
      cause: error,
    });
  }
  // RLS / permissão
  if (code === '42501' || status === 403) {
    return new AppError('forbidden', { technical: message, cause: error });
  }
  if (status === 401) {
    return new AppError('auth', { technical: message, cause: error });
  }
  if (status === 404) {
    return new AppError('not_found', { technical: message, cause: error });
  }
  if (message && /fetch|network|Failed to fetch|timeout/i.test(message)) {
    return new AppError('network', { technical: message, cause: error });
  }

  return new AppError('unknown', { technical: message, cause: error });
}

/** Extrai a mensagem segura de qualquer erro. Nunca lança. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  return normalizeSupabaseError(error).userMessage;
}

/**
 * Tipos e helpers compartilhados da camada de serviços da LuxCar.
 *
 * A camada de serviços consolida o acesso a dados que hoje está espalhado
 * diretamente nas páginas. É ADITIVA: preserva os contratos consumidos pelo
 * frontend (mesmos shapes de linha do Supabase) e apenas centraliza query,
 * escopo de tenant, paginação e tratamento de erro.
 */

import type { Profile } from '../lib/supabase';
import { AppError } from '../lib/errors';

/** Contexto do usuário autenticado, exigido por operações sensíveis a tenant. */
export type TenantContext = {
  userId: string;
  companyId: string | null;
  role: Profile['role'];
};

/** Deriva o contexto de tenant a partir do Profile carregado no AuthContext. */
export function tenantContextFromProfile(
  userId: string | undefined,
  profile: Profile | null | undefined
): TenantContext {
  if (!userId) {
    throw new AppError('auth', { technical: 'tenantContextFromProfile: userId ausente' });
  }
  return {
    userId,
    companyId: profile?.company_id ?? null,
    role: profile?.role ?? 'vendedor',
  };
}

/**
 * Aplica isolamento por loja (defense-in-depth na aplicação, além da RLS).
 *
 * IMPORTANTE: isto NÃO substitui Row Level Security no Supabase — é uma camada
 * extra. Quando `companyId` for null, a query não é escopada aqui (usuário sem
 * loja / dado legado); nesses casos a RLS é a única barreira. Ver
 * `.ai/handoffs/conflicts.md` (risco de isolamento).
 *
 * `q` é o query builder do Supabase; usamos `any` local apenas porque o tipo
 * genérico do PostgrestFilterBuilder não é exportado de forma estável.
 */
export function scopeToTenant<Q extends { eq: (col: string, val: unknown) => Q }>(
  q: Q,
  ctx: TenantContext,
  column = 'company_id'
): Q {
  if (ctx.companyId) return q.eq(column, ctx.companyId);
  return q;
}

/** Parâmetros de paginação padronizados. */
export type PageParams = {
  /** página começando em 1 */
  page?: number;
  /** itens por página (default 20, máx 100) */
  pageSize?: number;
};

export type Paginated<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Normaliza page/pageSize e devolve o range [from, to] para `.range()`. */
export function resolveRange(params?: PageParams): {
  page: number;
  pageSize: number;
  from: number;
  to: number;
} {
  const page = Math.max(1, Math.floor(params?.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(params?.pageSize ?? DEFAULT_PAGE_SIZE))
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

/** Monta o envelope paginado a partir do count exato do Supabase. */
export function buildPage<T>(
  rows: T[],
  count: number | null,
  page: number,
  pageSize: number
): Paginated<T> {
  const total = count ?? rows.length;
  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

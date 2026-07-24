/**
 * Serviço de Negociações — camada de serviços aditiva da LuxCar.
 *
 * Consolida o acesso a `negotiations` (hoje em `Negotiations.tsx`,
 * `NegotiationDetails.tsx`, `NegotiationForm.tsx`, `Dashboard.tsx`).
 *
 * REGRA DE NEGÓCIO encapsulada: ao criar uma negociação, o veículo passa para
 * `em_negociacao`. Hoje esse efeito colateral está no `NegotiationForm.tsx`.
 * Aqui ele fica no backend, num único lugar.
 *
 * CONTRATO PRESERVADO: mesmos shapes (`Negotiation` e a projeção com
 * `vehicle`/`seller` usada nas listagens). Aditivo — nada importa isto ainda.
 */

import { supabase, type Negotiation, type Vehicle, type Profile } from '../lib/supabase';
import { normalizeSupabaseError, AppError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import {
  scopeToTenant,
  resolveRange,
  buildPage,
  type TenantContext,
  type PageParams,
  type Paginated,
} from './shared';

const log = createLogger('negotiations');

/** Projeção usada nas listagens/detalhe (join com veículo e vendedor). */
export type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

const WITH_DETAILS = `
  *,
  vehicle:vehicles(*),
  seller:profiles(*)
`;

const ACTIVE_EXCLUDED: Negotiation['stage'][] = ['finalizado', 'perdido'];

export type NegotiationListFilters = {
  stage?: Negotiation['stage'];
  /** `true` = apenas negociações ativas (exclui finalizado/perdido) */
  onlyActive?: boolean;
  /** busca por nome do cliente (ilike) */
  search?: string;
};

/** Lista negociações do tenant, paginado e com join preservado. */
export async function listNegotiations(
  ctx: TenantContext,
  filters: NegotiationListFilters = {},
  page?: PageParams
): Promise<Paginated<NegotiationWithDetails>> {
  const { page: p, pageSize, from, to } = resolveRange(page);

  let query = supabase
    .from('negotiations')
    .select(WITH_DETAILS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  query = scopeToTenant(query, ctx);

  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.onlyActive) query = query.not('stage', 'in', `(${ACTIVE_EXCLUDED.join(',')})`);
  if (filters.search && filters.search.trim()) {
    query = query.ilike('client_name', `%${filters.search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    log.error('listNegotiations falhou', error);
    throw normalizeSupabaseError(error);
  }
  return buildPage<NegotiationWithDetails>(
    (data as unknown as NegotiationWithDetails[]) ?? [],
    count,
    p,
    pageSize
  );
}

/** Busca uma negociação (com join) escopada ao tenant. */
export async function getNegotiation(
  ctx: TenantContext,
  id: string
): Promise<NegotiationWithDetails> {
  let query = supabase.from('negotiations').select(WITH_DETAILS).eq('id', id);
  query = scopeToTenant(query, ctx);

  const { data, error } = await query.single();
  if (error) throw normalizeSupabaseError(error);
  return data as unknown as NegotiationWithDetails;
}

export type CreateNegotiationInput = {
  vehicle_id: string;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_cpf?: string | null;
  stage?: Negotiation['stage'];
  offered_price?: number | null;
  notes?: string | null;
  priority?: Negotiation['priority'];
};

/**
 * Cria a negociação e aplica a regra: veículo → `em_negociacao`.
 * A atualização do veículo é escopada ao tenant. Se a negociação for criada mas
 * o update do veículo falhar, o erro é logado e propagado (comportamento igual
 * ao atual, que também não é transacional — dívida: mover para RPC/transação).
 */
export async function createNegotiation(
  ctx: TenantContext,
  input: CreateNegotiationInput
): Promise<Negotiation> {
  if (!input.vehicle_id) {
    throw new AppError('validation', { userMessage: 'Selecione um veículo.' });
  }
  if (!input.client_name || !input.client_name.trim()) {
    throw new AppError('validation', { userMessage: 'Informe o nome do cliente.' });
  }

  const payload = {
    company_id: ctx.companyId,
    vehicle_id: input.vehicle_id,
    seller_id: ctx.userId,
    client_name: input.client_name.trim(),
    client_phone: input.client_phone || null,
    client_email: input.client_email || null,
    client_cpf: input.client_cpf || null,
    stage: input.stage || 'primeiro_contato',
    offered_price: input.offered_price ?? null,
    notes: input.notes || null,
    priority: input.priority || 'media',
  };

  const { data, error } = await supabase
    .from('negotiations')
    .insert([payload])
    .select()
    .single();
  if (error) {
    log.error('createNegotiation falhou', error);
    throw normalizeSupabaseError(error);
  }

  let vq = supabase.from('vehicles').update({ status: 'em_negociacao' }).eq('id', input.vehicle_id);
  vq = scopeToTenant(vq, ctx);
  const { error: vErr } = await vq;
  if (vErr) {
    log.error('createNegotiation: falha ao marcar veículo em_negociacao', vErr);
    throw normalizeSupabaseError(vErr);
  }

  return data as Negotiation;
}

/** Atualiza campos da negociação (ex.: estágio, prioridade), escopado ao tenant. */
export async function updateNegotiation(
  ctx: TenantContext,
  id: string,
  patch: Partial<Negotiation>
): Promise<Negotiation> {
  let query = supabase.from('negotiations').update(patch).eq('id', id);
  query = scopeToTenant(query, ctx);

  const { data, error } = await query.select().single();
  if (error) {
    log.error('updateNegotiation falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data as Negotiation;
}

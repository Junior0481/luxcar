/**
 * Serviço de Leads — camada de serviços aditiva da LuxCar.
 *
 * Consolida `leads` (hoje em `LeadForm.tsx`, público). Preserva o contrato de
 * insert atual (source 'website', status 'new') e centraliza validação.
 *
 * Nota: o `LeadForm` é público (catálogo). O `company_id` vem do contexto da
 * loja pública, não de um usuário autenticado — por isso este serviço aceita
 * `companyId` explícito em vez de `TenantContext`.
 */

import { supabase, type Lead } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { scopeToTenant, resolveRange, buildPage, type TenantContext, type PageParams, type Paginated } from './shared';
import { assertValid, validateLead } from './validation';

const log = createLogger('leads');

export type CreateLeadInput = {
  company_id: string;
  vehicle_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  message?: string | null;
  source?: string;
  turnstile_token: string;
};

/** Cria um lead público pela Edge Function, após validação Turnstile no servidor. */
export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const valid = assertValid(
    validateLead({
      company_id: input.company_id,
      customer_name: input.customer_name,
      customer_email: input.customer_email ?? undefined,
      customer_phone: input.customer_phone ?? undefined,
    })
  );

  const payload = {
    company_id: valid.company_id,
    vehicle_id: input.vehicle_id || null,
    customer_name: valid.customer_name,
    customer_email: valid.customer_email || null,
    customer_phone: valid.customer_phone || null,
    message: input.message || null,
    source: input.source || 'website',
    status: 'new' as const,
  };

  const { data, error } = await supabase.functions.invoke('public-lead', {
    body: { ...payload, turnstile_token: input.turnstile_token },
  });
  if (error) {
    log.error('createLead falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data.lead as Lead;
}

export type LeadListFilters = { status?: Lead['status']; assignedTo?: string };

/** Lista leads do tenant, paginado (uso interno/gestor). */
export async function listLeads(
  ctx: TenantContext,
  filters: LeadListFilters = {},
  page?: PageParams
): Promise<Paginated<Lead>> {
  const { page: p, pageSize, from, to } = resolveRange(page);

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  query = scopeToTenant(query, ctx);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

  const { data, error, count } = await query;
  if (error) {
    log.error('listLeads falhou', error);
    throw normalizeSupabaseError(error);
  }
  return buildPage<Lead>(data ?? [], count, p, pageSize);
}

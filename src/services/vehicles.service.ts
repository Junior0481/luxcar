/**
 * Serviço de Veículos — implementação-referência da camada de serviços da LuxCar.
 *
 * Consolida o acesso a `vehicles` (hoje feito direto em `Vehicles.tsx`,
 * `VehicleDetails.tsx`, `Dashboard.tsx`) com:
 *  - isolamento por tenant na aplicação (defense-in-depth sobre a RLS);
 *  - paginação real (`.range()` + count exato) — evita `select('*')` sem limite;
 *  - validação server-side-lite antes de escrever;
 *  - erros normalizados (sem vazar detalhe técnico para a UI).
 *
 * CONTRATO PRESERVADO: os métodos devolvem `Vehicle`/`Vehicle[]` — os mesmos
 * shapes já consumidos pelas páginas. Migrar as páginas para este serviço é
 * incremental e é tarefa conjunta com o Codex (ver shared-contracts.md).
 *
 * Este arquivo é ADITIVO: nada hoje o importa ainda, portanto não altera
 * comportamento existente.
 */

import { supabase, type Vehicle } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import {
  scopeToTenant,
  resolveRange,
  buildPage,
  type TenantContext,
  type PageParams,
  type Paginated,
} from './shared';
import { assertValid, validateVehicle, type VehicleInput } from './validation';

const log = createLogger('vehicles');

export type VehicleListFilters = {
  status?: Vehicle['status'];
  /** busca por marca/modelo (ilike) */
  search?: string;
};

/**
 * Lista veículos do tenant, paginado e filtrado no banco (não no cliente).
 * Substitui o padrão atual de `select('*')` + filtro em memória.
 */
export async function listVehicles(
  ctx: TenantContext,
  filters: VehicleListFilters = {},
  page?: PageParams
): Promise<Paginated<Vehicle>> {
  const { page: p, pageSize, from, to } = resolveRange(page);

  let query = supabase
    .from('vehicles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  query = scopeToTenant(query, ctx);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`brand.ilike.${term},model.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) {
    log.error('listVehicles falhou', error);
    throw normalizeSupabaseError(error);
  }
  return buildPage<Vehicle>(data ?? [], count, p, pageSize);
}

/** Busca um veículo por id, escopado ao tenant. */
export async function getVehicle(ctx: TenantContext, id: string): Promise<Vehicle> {
  let query = supabase.from('vehicles').select('*').eq('id', id);
  query = scopeToTenant(query, ctx);

  const { data, error } = await query.single();
  if (error) throw normalizeSupabaseError(error);
  return data as Vehicle;
}

/** Cria um veículo já carimbado com o tenant e o autor. */
export async function createVehicle(
  ctx: TenantContext,
  input: Partial<VehicleInput> & Record<string, unknown>
): Promise<Vehicle> {
  const valid = assertValid(validateVehicle(input));

  const payload = {
    ...input,
    ...valid,
    company_id: ctx.companyId,
    created_by: ctx.userId,
  };

  const { data, error } = await supabase.from('vehicles').insert([payload]).select().single();
  if (error) {
    log.error('createVehicle falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data as Vehicle;
}

/** Atualiza um veículo do tenant. Revalida os campos de negócio enviados. */
export async function updateVehicle(
  ctx: TenantContext,
  id: string,
  patch: Partial<VehicleInput> & Record<string, unknown>
): Promise<Vehicle> {
  // valida apenas se os campos de negócio vierem no patch
  if (
    patch.brand !== undefined ||
    patch.model !== undefined ||
    patch.year !== undefined ||
    patch.purchase_price !== undefined ||
    patch.sale_price !== undefined
  ) {
    assertValid(validateVehicle({ ...patch }));
  }

  let query = supabase.from('vehicles').update(patch).eq('id', id);
  query = scopeToTenant(query, ctx);

  const { data, error } = await query.select().single();
  if (error) {
    log.error('updateVehicle falhou', error);
    throw normalizeSupabaseError(error);
  }
  return data as Vehicle;
}

/**
 * Exclui um veículo do tenant, aplicando a REGRA DE NEGÓCIO no backend:
 * não excluir veículo que já possua venda registrada.
 *
 * Hoje essa regra está no frontend (`Vehicles.tsx handleDelete`). Aqui ela vira
 * server-side-lite; a barreira definitiva continua sendo a FK/constraint no
 * banco (ver conflicts.md — sugerir ON DELETE RESTRICT / trigger).
 */
export async function deleteVehicle(ctx: TenantContext, id: string): Promise<void> {
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id')
    .eq('vehicle_id', id)
    .limit(1);
  if (salesError) throw normalizeSupabaseError(salesError);
  if (sales && sales.length > 0) {
    throw new (await import('../lib/errors')).AppError('conflict', {
      userMessage: 'Não é possível excluir: este veículo já possui vendas registradas.',
    });
  }

  let query = supabase.from('vehicles').delete().eq('id', id);
  query = scopeToTenant(query, ctx);

  const { error } = await query;
  if (error) {
    log.error('deleteVehicle falhou', error);
    throw normalizeSupabaseError(error);
  }
}

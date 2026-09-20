import { describe, expect, it } from 'vitest';
import type { Negotiation, Vehicle } from '../lib/supabase';
import {
  canManageVehicles,
  canTransitionPayment,
  canUpdateNegotiation,
  dashboardMetrics,
  publicInventory
} from './rules';

const companyA = 'company-a';
const companyB = 'company-b';

const vehicle = (status: Vehicle['status'], purchase = 50_000, sale = 60_000) => ({
  id: crypto.randomUUID(), company_id: companyA, brand: 'Marca', model: 'Modelo', year: 2025,
  purchase_price: purchase, sale_price: sale, status, created_at: '', updated_at: ''
} satisfies Vehicle);

const negotiation = (stage: Negotiation['stage']) => ({
  id: crypto.randomUUID(), company_id: companyA, vehicle_id: 'vehicle', seller_id: 'seller',
  client_name: 'Cliente', stage, priority: 'media', created_at: '', updated_at: ''
} satisfies Negotiation);

describe('controle de permissões multitenant', () => {
  it('permite gestão de veículos apenas ao administrador vinculado', () => {
    expect(canManageVehicles({ role: 'administrador', company_id: companyA })).toBe(true);
    expect(canManageVehicles({ role: 'vendedor', company_id: companyA })).toBe(false);
    expect(canManageVehicles({ role: 'administrador' })).toBe(false);
  });

  it('impede atualização de negociação de outro tenant', () => {
    expect(canUpdateNegotiation({ role: 'vendedor', company_id: companyA }, { company_id: companyA })).toBe(true);
    expect(canUpdateNegotiation({ role: 'administrador', company_id: companyA }, { company_id: companyB })).toBe(false);
  });
});

describe('estoque e dashboard', () => {
  const vehicles = [vehicle('disponivel'), vehicle('em_negociacao', 40_000, 55_000), vehicle('vendido')];
  const negotiations = [negotiation('primeiro_contato'), negotiation('finalizado'), negotiation('perdido')];

  it('expõe somente veículos disponíveis no estoque público', () => {
    expect(publicInventory(vehicles)).toHaveLength(1);
  });

  it('calcula indicadores apenas com os dados recebidos pelo tenant', () => {
    expect(dashboardMetrics(vehicles, negotiations)).toEqual({
      vehiclesAvailable: 1,
      vehiclesInNegotiation: 1,
      vehiclesSold: 1,
      activeNegotiations: 1,
      potentialProfit: 25_000
    });
  });
});

describe('pagamentos', () => {
  it('aceita o fluxo normal e bloqueia regressões inválidas', () => {
    expect(canTransitionPayment('pending', 'authorized')).toBe(true);
    expect(canTransitionPayment('authorized', 'paid')).toBe(true);
    expect(canTransitionPayment('paid', 'pending')).toBe(false);
  });
});

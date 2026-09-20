import type { Negotiation, Profile, Vehicle } from '../lib/supabase';

export const NEGOTIATION_STAGES: Negotiation['stage'][] = [
  'primeiro_contato',
  'avaliacao',
  'test_drive_agendado',
  'test_drive_realizado',
  'proposta_enviada',
  'negociacao_preco',
  'aprovacao_credito',
  'documentacao',
  'finalizado',
  'perdido'
];

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'cancelled' | 'refunded';

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['authorized', 'paid', 'cancelled'],
  authorized: ['paid', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: []
};

export function canManageVehicles(profile: Pick<Profile, 'role' | 'company_id'> | null) {
  return Boolean(profile?.company_id && profile.role === 'administrador');
}

export function canUpdateNegotiation(
  profile: Pick<Profile, 'role' | 'company_id'> | null,
  negotiation: Pick<Negotiation, 'company_id'>
) {
  return Boolean(
    profile?.company_id &&
    negotiation.company_id === profile.company_id &&
    ['administrador', 'vendedor'].includes(profile.role)
  );
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function publicInventory(vehicles: Vehicle[]) {
  return vehicles.filter((vehicle) => vehicle.status === 'disponivel');
}

export function dashboardMetrics(vehicles: Vehicle[], negotiations: Negotiation[]) {
  return {
    vehiclesAvailable: vehicles.filter((vehicle) => vehicle.status === 'disponivel').length,
    vehiclesInNegotiation: vehicles.filter((vehicle) => vehicle.status === 'em_negociacao').length,
    vehiclesSold: vehicles.filter((vehicle) => vehicle.status === 'vendido').length,
    activeNegotiations: negotiations.filter((item) => !['finalizado', 'perdido'].includes(item.stage)).length,
    potentialProfit: vehicles
      .filter((vehicle) => vehicle.status !== 'vendido')
      .reduce((total, vehicle) => total + Number(vehicle.sale_price) - Number(vehicle.purchase_price), 0)
  };
}

/**
 * Validação de entrada da LuxCar (server-side-lite, sem dependência nova).
 *
 * Regra de negócio de validação vive AQUI, não na UI. A UI pode dar feedback
 * imediato, mas a fonte de verdade da validação é esta camada — assim os
 * serviços rejeitam entradas inválidas antes de tocar o banco.
 *
 * Não usa zod para não introduzir dependência/lockfile churn nesta sprint.
 * Se a validação crescer, migrar para zod é o próximo passo (dívida registrada).
 */

import { AppError } from '../lib/errors';

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

function fail(errors: FieldErrors): ValidationResult<never> {
  return { ok: false, errors };
}

/** Lança AppError('validation') com o primeiro erro — para uso dentro de serviços. */
export function assertValid<T>(result: ValidationResult<T>): T {
  if (result.ok === true) return (result as { ok: true; value: T }).value;
  const errors = (result as { ok: false; errors: FieldErrors }).errors;
  const first = Object.values(errors)[0] ?? 'Dados inválidos.';
  throw new AppError('validation', {
    userMessage: first,
    technical: JSON.stringify(errors),
  });
}

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// ---- Veículo -------------------------------------------------------------

export type VehicleInput = {
  brand: string;
  model: string;
  year: number;
  purchase_price: number;
  sale_price: number;
  status?: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const VEHICLE_STATUSES = ['disponivel', 'em_negociacao', 'vendido'];

export function validateVehicle(input: Partial<VehicleInput>): ValidationResult<VehicleInput> {
  const errors: FieldErrors = {};

  if (isBlank(input.brand)) errors.brand = 'Informe a marca.';
  if (isBlank(input.model)) errors.model = 'Informe o modelo.';

  const year = Number(input.year);
  if (!Number.isFinite(year) || year < 1900 || year > CURRENT_YEAR + 1) {
    errors.year = `Ano inválido (1900–${CURRENT_YEAR + 1}).`;
  }

  const purchase = Number(input.purchase_price);
  if (!Number.isFinite(purchase) || purchase < 0) {
    errors.purchase_price = 'Preço de compra inválido.';
  }

  const sale = Number(input.sale_price);
  if (!Number.isFinite(sale) || sale < 0) {
    errors.sale_price = 'Preço de venda inválido.';
  }

  if (input.status !== undefined && !VEHICLE_STATUSES.includes(String(input.status))) {
    errors.status = 'Status inválido.';
  }

  if (Object.keys(errors).length > 0) return fail(errors);

  return {
    ok: true,
    value: {
      brand: String(input.brand).trim(),
      model: String(input.model).trim(),
      year,
      purchase_price: purchase,
      sale_price: sale,
      status: input.status ? String(input.status) : undefined,
    },
  };
}

// ---- Lead ----------------------------------------------------------------

export type LeadInput = {
  company_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input: Partial<LeadInput>): ValidationResult<LeadInput> {
  const errors: FieldErrors = {};

  if (isBlank(input.company_id)) errors.company_id = 'Loja não identificada.';
  if (isBlank(input.customer_name)) errors.customer_name = 'Informe o nome do cliente.';
  if (!isBlank(input.customer_email) && !EMAIL_RE.test(String(input.customer_email))) {
    errors.customer_email = 'E-mail inválido.';
  }
  if (isBlank(input.customer_email) && isBlank(input.customer_phone)) {
    errors.contact = 'Informe e-mail ou telefone para contato.';
  }

  if (Object.keys(errors).length > 0) return fail(errors);

  return {
    ok: true,
    value: {
      company_id: String(input.company_id),
      customer_name: String(input.customer_name).trim(),
      customer_email: input.customer_email ? String(input.customer_email).trim() : undefined,
      customer_phone: input.customer_phone ? String(input.customer_phone).trim() : undefined,
    },
  };
}

// ---- Custo de veículo ----------------------------------------------------

export type VehicleCostInput = {
  vehicle_id: string;
  cost_type: string;
  description: string;
  amount: number;
};

const COST_TYPES = ['manutencao', 'estetica', 'mecanica', 'revisao', 'laudo', 'outro'];

export function validateVehicleCost(
  input: Partial<VehicleCostInput>
): ValidationResult<VehicleCostInput> {
  const errors: FieldErrors = {};

  if (isBlank(input.vehicle_id)) errors.vehicle_id = 'Veículo não identificado.';
  if (isBlank(input.description)) errors.description = 'Descreva o custo.';
  if (input.cost_type !== undefined && !COST_TYPES.includes(String(input.cost_type))) {
    errors.cost_type = 'Tipo de custo inválido.';
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    errors.amount = 'Valor inválido.';
  }

  if (Object.keys(errors).length > 0) return fail(errors);

  return {
    ok: true,
    value: {
      vehicle_id: String(input.vehicle_id),
      cost_type: input.cost_type ? String(input.cost_type) : 'outro',
      description: String(input.description).trim(),
      amount,
    },
  };
}

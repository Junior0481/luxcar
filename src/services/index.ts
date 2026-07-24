/**
 * Ponto único de importação da camada de serviços da LuxCar.
 *
 * Uso nas páginas (quando migrar, em conjunto com o Codex):
 *
 *   import { listVehicles, tenantContextFromProfile } from '@/services';
 *   const ctx = tenantContextFromProfile(user?.id, profile);
 *   const { rows, total } = await listVehicles(ctx, { status }, { page });
 */

export * from './shared';
export * from './validation';
export * from './vehicles.service';
export * from './negotiations.service';
export * from './leads.service';
export * from './costs.service';
export * from './dashboard.service';

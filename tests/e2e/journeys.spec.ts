import { expect, test } from '@playwright/test';
import { expectNoBrowserIssues, login, monitorBrowserIssues, requiredCredentials } from './helpers';

test.describe('jornadas reais por perfil', () => {
  test('administrador navega pelos módulos e possui permissão de cadastro', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'Credenciais de administrador não configuradas.');
    const issues = monitorBrowserIssues(page);
    const credentials = requiredCredentials('ADMIN');
    await login(page, credentials.email, credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    const routes = [
      ['/dashboard/vehicles', 'Estoque da loja'],
      ['/dashboard/negotiations', 'Negociações'],
      ['/dashboard/payments', 'Pagamentos'],
      ['/dashboard/reports', 'Relatórios'],
      ['/dashboard/settings', 'Configurações']
    ] as const;
    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
    await page.goto('/dashboard/vehicles');
    await expect(page.getByRole('button', { name: 'Adicionar veículo' })).toBeVisible();
    expectNoBrowserIssues(issues);
  });

  test('vendedor acessa operação, mas não administra veículos', async ({ page }) => {
    test.skip(!process.env.E2E_SELLER_EMAIL || !process.env.E2E_SELLER_PASSWORD, 'Credenciais de vendedor não configuradas.');
    const issues = monitorBrowserIssues(page);
    const credentials = requiredCredentials('SELLER');
    await login(page, credentials.email, credentials.password);
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await page.goto('/dashboard/vehicles');
    await expect(page.getByRole('heading', { name: 'Estoque da loja' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar veículo' })).toHaveCount(0);
    await page.goto('/dashboard/negotiations');
    await expect(page.getByRole('heading', { name: 'Negociações' })).toBeVisible();
    expectNoBrowserIssues(issues);
  });

  test('cliente entra pela área correta e não acessa o painel interno', async ({ page }) => {
    test.skip(!process.env.E2E_CLIENT_EMAIL || !process.env.E2E_CLIENT_PASSWORD, 'Credenciais de cliente não configuradas.');
    const issues = monitorBrowserIssues(page);
    const credentials = requiredCredentials('CLIENT');
    await login(page, credentials.email, credentials.password, true);
    await expect(page).toHaveURL(/\/estoque/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/estoque/);
    expectNoBrowserIssues(issues);
  });
});

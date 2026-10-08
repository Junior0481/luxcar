import { expect, test, Page } from '@playwright/test';
import { login } from './helpers';

// Fumaça logada: abre todas as telas do painel com os logins de DEMO do Supabase LOCAL
// (seed do orch/preview, ver PREVIEW.md) e falha se qualquer tela mostrar "Erro ao carregar".
// Rodar: E2E_BASE_URL=http://127.0.0.1:5180 pnpm exec playwright test smoke-logged --project=desktop-chromium --workers=2
// (com 6 workers o Vite dev em :5180 dá timeouts espúrios de networkidle)
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'Demo@12345';

const NEGOTIATION_A = 'f0000000-0000-0000-0000-000000000001'; // LuxCar, vendedor@luxcar.demo
const VEHICLE_A = 'e0000000-0000-0000-0000-000000000001'; // LuxCar

const storePages = [
  '/dashboard',
  '/dashboard/vehicles',
  `/dashboard/vehicles/${VEHICLE_A}`,
  '/dashboard/leads',
  '/dashboard/negotiations',
  `/dashboard/negotiations/${NEGOTIATION_A}`,
  '/dashboard/reports',
  '/dashboard/payments',
  '/dashboard/team',
  '/dashboard/settings',
];

const roles: { name: string; email: string; pages: string[] }[] = [
  { name: 'admin loja A', email: 'admin@luxcar.demo', pages: storePages },
  { name: 'vendedor loja A', email: 'vendedor@luxcar.demo', pages: storePages },
  { name: 'vendedor loja B', email: 'vendedor@autopremium.demo', pages: ['/dashboard', '/dashboard/vehicles', '/dashboard/leads', '/dashboard/negotiations', '/dashboard/settings'] },
  { name: 'plataforma', email: 'plataforma@luxcar.demo', pages: ['/dashboard', '/dashboard/platform', '/dashboard/settings'] },
];

async function expectPageLoadedWithoutError(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  // Espera os spinners de carregamento sumirem antes de procurar alertas de erro.
  await expect(page.getByRole('status').filter({ hasText: /Carregando/i })).toHaveCount(0, { timeout: 15_000 });
  const errors = page.getByText(/Erro ao carregar/i);
  const messages = await errors.allInnerTexts();
  expect(messages, `${path} mostrou erro: ${messages.join(' | ')}`).toEqual([]);
}

test('plataforma: "Empresas cadastradas" lista as lojas da demo', async ({ page }) => {
  await login(page, 'plataforma@luxcar.demo', DEMO_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expectPageLoadedWithoutError(page, '/dashboard/platform');
  await expect(page.getByText('LuxCar Motors').first()).toBeVisible();
  await expect(page.getByText('Auto Premium').first()).toBeVisible();
});

for (const role of roles) {
  test.describe(`fumaça logada: ${role.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page, role.email, DEMO_PASSWORD);
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    });

    for (const path of role.pages) {
      test(`${path} carrega sem "Erro ao carregar"`, async ({ page }) => {
        await expectPageLoadedWithoutError(page, path);
      });
    }
  });
}

import { expect, test } from '@playwright/test';
import { expectNoBrowserIssues, login, monitorBrowserIssues } from './helpers';

test('jornada white label completa: empresa, equipe, veículo, negociação e pagamento', async ({ page }) => {
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== 'true', 'Defina E2E_ALLOW_MUTATIONS=true para criar dados de teste.');
  test.skip(!process.env.E2E_PLATFORM_EMAIL || !process.env.E2E_PLATFORM_PASSWORD, 'Credenciais da plataforma não configuradas.');
  test.setTimeout(90_000);
  const issues = monitorBrowserIssues(page);
  const run = Date.now().toString().slice(-8);
  const companyName = `Loja E2E ${run}`;
  const slug = `loja-e2e-${run}`;
  const adminEmail = `admin.${run}@e2e.luxcar.com.br`;
  const sellerEmail = `vendedor.${run}@e2e.luxcar.com.br`;
  const password = `Teste${run}!Aa`;
  const vehicleModel = `Modelo E2E ${run}`;
  const clientName = `Cliente E2E ${run}`;

  await login(page, process.env.E2E_PLATFORM_EMAIL!, process.env.E2E_PLATFORM_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard\/platform/);
  await page.getByLabel('Nome da empresa').fill(companyName);
  await page.getByLabel('Identificador (slug)').fill(slug);
  await page.getByLabel('Nome do administrador').fill(`Admin E2E ${run}`);
  await page.getByLabel('Email do administrador').fill(adminEmail);
  await page.getByLabel('Senha inicial').fill(password);
  await page.getByRole('button', { name: 'Criar empresa e administrador' }).click();
  await expect(page.getByRole('status')).toContainText('Empresa e administrador criados');

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await login(page, adminEmail, password);
  await expect(page).toHaveURL(/\/dashboard\/?$/);

  await page.goto('/dashboard/settings');
  await page.getByRole('button', { name: /Marca/ }).click();
  await page.getByLabel('Cor principal').fill('#2563eb');
  await page.getByLabel('Cor secundária').fill('#0f172a');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('status')).toContainText('Identidade da loja atualizada');

  await page.goto('/dashboard/team');
  await page.getByLabel('Nome completo').fill(`Vendedor E2E ${run}`);
  await page.getByLabel('Email').fill(sellerEmail);
  await page.getByLabel('Senha inicial').fill(password);
  await page.getByRole('button', { name: 'Criar acesso' }).click();
  await expect(page.getByRole('status')).toContainText('Acesso criado com sucesso');
  await expect(page.getByText(sellerEmail)).toBeVisible();

  await page.goto('/dashboard/vehicles');
  await page.getByRole('button', { name: 'Adicionar veículo' }).first().click();
  await page.getByLabel('Marca *').selectOption('Toyota');
  await page.getByLabel('Modelo *').fill(vehicleModel);
  await page.getByLabel('Ano *').fill('2025');
  await page.getByLabel('Valor de Compra (R$) *').fill('70000');
  await page.getByLabel('Valor de Venda (R$) *').fill('85000');
  await page.getByLabel('Placa').fill(`E2E${run.slice(-4)}`);
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page.getByText(`Toyota ${vehicleModel}`)).toBeVisible();

  await page.goto('/dashboard/negotiations');
  await page.getByRole('button', { name: 'Nova negociação' }).first().click();
  const vehicleOption = page.getByLabel('Veículo *').locator('option').filter({ hasText: vehicleModel });
  await page.getByLabel('Veículo *').selectOption((await vehicleOption.getAttribute('value'))!);
  await page.getByLabel('Nome do Cliente *').fill(clientName);
  await page.getByLabel('Valor Proposto (R$)').fill('83000');
  await page.getByRole('button', { name: 'Criar Negociação' }).click();
  await expect(page.getByText(clientName)).toBeVisible();
  await page.getByRole('link', { name: 'Ver oportunidade' }).click();
  await page.getByRole('button', { name: 'alta' }).click();

  const stage = page.locator('select').filter({ has: page.locator('option[value="primeiro_contato"]') });
  for (const nextStage of ['avaliacao', 'test_drive_agendado', 'test_drive_realizado', 'proposta_enviada', 'negociacao_preco', 'aprovacao_credito', 'documentacao']) {
    await stage.selectOption(nextStage);
    await expect(stage).toHaveValue(nextStage);
  }

  await page.goto('/dashboard/payments');
  await page.getByLabel('Negociação').selectOption({ label: clientName });
  await page.getByLabel('Valor').fill('83000');
  await page.getByLabel('Forma').selectOption('pix');
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Pagamento registrado');
  const payment = page.locator('[data-slot="card"]').filter({ hasText: clientName }).last();
  await payment.getByRole('button', { name: 'Autorizar' }).click();
  await expect(payment).toContainText('authorized');
  await payment.getByRole('button', { name: 'Marcar como pago' }).click();
  await expect(payment).toContainText('paid');

  await page.goto('/dashboard/vehicles');
  await expect(page.getByText(vehicleModel)).toBeVisible();
  await expect(page.getByText('Vendido').first()).toBeVisible();
  expectNoBrowserIssues(issues);
});

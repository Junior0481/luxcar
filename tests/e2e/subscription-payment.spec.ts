import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

// Cadastro → link mágico → pagamento → loja criada pelo webhook → renovação.
// Só roda com a AbacatePay em modo de desenvolvimento ("Simular Pagamento") e contra o site publicado,
// porque o link mágico e o retorno do checkout apontam para a URL configurada no Supabase/SITE_URL.
// O dono cria a senha pelo "Esqueceu sua senha?", como no primeiro acesso real.
// Cria uma loja "Loja E2E Pagamento …" de verdade; apague depois com o SQL de limpeza de lojas E2E.

const MAIL_TM = 'https://api.mail.tm';

async function mailTm<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${MAIL_TM}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`mail.tm ${path}: ${response.status} ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  throw new Error(`mail.tm ${path}: limite de requisições`);
}

async function createInbox(run: string) {
  const { 'hydra:member': domains } = await mailTm<{ 'hydra:member': { domain: string }[] }>('/domains');
  const address = `luxcar-e2e-${run}@${domains[0].domain}`;
  const password = `Pw-${run}-e2e!`;
  await mailTm('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
  const { token } = await mailTm<{ token: string }>('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
  return { address, token };
}

/** Espera um email novo (além dos `seen` já recebidos) com link do Supabase Auth. */
async function waitForAuthLink(token: string, seen: number) {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const { 'hydra:member': messages } = await mailTm<{ 'hydra:member': { id: string }[] }>('/messages', {}, token);
    if (messages.length <= seen) continue;
    const message = await mailTm<{ html?: string[]; text?: string }>(`/messages/${messages[0].id}`, {}, token);
    const body = (message.html || []).join('') + (message.text || '');
    const link = body.match(/https:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]+/)?.[0];
    if (link) return link.replace(/&amp;/g, '&');
  }
  throw new Error('O email do Supabase Auth não chegou em 3 minutos.');
}

/** Paga o checkout aberto na página usando a simulação do modo de desenvolvimento da AbacatePay. */
async function payWithSimulatedPix(page: Page) {
  await page.waitForURL(/abacatepay\.com/, { timeout: 30_000 });
  const fillFake = page.getByText('Preencher com dados fictícios');
  await fillFake.waitFor({ timeout: 20_000 }).catch(() => {
    test.skip(true, 'Checkout sem modo de desenvolvimento: a AbacatePay está com a chave de produção.');
  });
  await fillFake.click();
  await page.getByRole('button', { name: /Pagar com Pix/ }).click();
  await page.getByRole('button', { name: /Simular Pagamento/ }).click();
}

test('assinatura paga pela AbacatePay cria a loja e a renovação adia o vencimento', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== 'true', 'Defina E2E_ALLOW_MUTATIONS=true para criar dados de teste.');
  test.skip(process.env.E2E_PAYMENT_FLOW !== 'true', 'Defina E2E_PAYMENT_FLOW=true para testar o pagamento na AbacatePay.');
  test.skip(!process.env.E2E_BASE_URL, 'O fluxo de pagamento precisa do site publicado (E2E_BASE_URL).');
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Fluxo pesado: roda só no desktop.');
  test.setTimeout(8 * 60_000);

  const site = new URL(baseURL!).host;
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const failure = `${response.status()} ${response.request().method()} ${response.url().split('?')[0]}`;
    failures.push(failure);
    console.log('[resposta com erro]', failure, '← página', page.url().split('?')[0]);
  });

  const run = Date.now().toString().slice(-8);
  const inbox = await createInbox(run);
  testInfo.annotations.push({ type: 'email', description: inbox.address }, { type: 'slug', description: `e2e-pagamento-${run}` });

  await test.step('cadastro pede o link mágico', async () => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: /Silver/ }).first().click();
    await page.getByRole('button', { name: /Continuar com Silver/ }).click();
    await page.fill('#companyName', `Loja E2E Pagamento ${run}`);
    await page.fill('#slug', `e2e-pagamento-${run}`);
    await page.fill('#ownerName', 'Teste Automatizado');
    await page.fill('#ownerEmail', inbox.address);
    await page.fill('#postalCode', '01001000');
    await expect(page.getByText('Endereço localizado')).toBeVisible({ timeout: 20_000 });
    await page.fill('#addressNumber', '100');
    await page.selectOption('#acquisitionSource', { index: 1 });
    await page.getByRole('button', { name: /Confirmar email e continuar/ }).click();
    await expect(page.getByText(/Enviamos um link/)).toBeVisible({ timeout: 20_000 });
  });

  await test.step('link mágico confirma o email e gera a cobrança', async () => {
    await page.goto(await waitForAuthLink(inbox.token, 0));
    await page.waitForURL(/\/auth\/register\/confirm/, { timeout: 30_000 });
    const payLink = page.getByRole('link', { name: /Ir para o pagamento/ });
    await expect(payLink).toBeVisible({ timeout: 30_000 });
    await payLink.click();
  });

  await test.step('pagamento volta ao login com o aviso de primeiro acesso', async () => {
    await payWithSimulatedPix(page);
    await page.waitForURL(/\/auth\/login\?pagamento=confirmado/, { timeout: 30_000 });
    await expect(page.getByRole('status')).toContainText('Pagamento recebido');
  });

  const password = `Senha-${run}!a`;
  await test.step('dono cria a senha pelo link de recuperação', async () => {
    await page.getByRole('status').getByRole('link', { name: 'Esqueceu sua senha?' }).click();
    await page.getByLabel('Email').fill(inbox.address);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByRole('status')).toContainText('enviaremos um link');
    await page.goto(await waitForAuthLink(inbox.token, 1));
    await page.getByLabel('Nova senha').fill(password);
    await page.getByLabel('Confirmar nova senha').fill(password);
    await page.getByRole('button', { name: /Salvar|Atualizar|Definir/ }).click();
    await expect(page.getByRole('status')).toContainText('Senha atualizada');
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
  });

  await test.step('loja criada pelo webhook abre a aba Assinatura', async () => {
    await login(page, inbox.address, password);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect.poll(async () => {
      await page.goto('/dashboard/settings?aba=assinatura');
      return page.getByRole('button', { name: /Pagar R\$/ }).isVisible({ timeout: 8_000 }).catch(() => false);
    }, { timeout: 90_000, intervals: [2_000] }).toBe(true);
  });

  const dueDate = page.locator('dt', { hasText: 'Próximo vencimento' }).locator('xpath=following-sibling::dd');
  const firstDue = (await dueDate.innerText()).trim();

  await test.step('renovação adia o vencimento sem recarregar a página', async () => {
    await page.getByRole('button', { name: /Pagar R\$/ }).click();
    await payWithSimulatedPix(page);
    await page.waitForURL(/\/dashboard\/settings/, { timeout: 30_000 });
    await expect(page.getByText(/Pagamento confirmado\. Próximo vencimento/)).toBeVisible({ timeout: 70_000 });
    await expect(dueDate).not.toHaveText(firstDue);
    await expect(page).not.toHaveURL(/pagamento=confirmado/);
  });

  const ownFailures = failures.filter((failure) => failure.includes(site) || failure.includes('supabase.co'));
  testInfo.annotations.push({ type: 'respostas 4xx/5xx', description: failures.join('\n') || 'nenhuma' });
  expect(ownFailures, ownFailures.join('\n')).toEqual([]);
});

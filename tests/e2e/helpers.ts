import { expect, Page } from '@playwright/test';

export type BrowserIssue = { type: 'pageerror' | 'console'; message: string };

export function monitorBrowserIssues(page: Page) {
  const issues: BrowserIssue[] = [];
  page.on('pageerror', (error) => issues.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push({ type: 'console', message: message.text() });
  });
  return issues;
}

export function expectNoBrowserIssues(issues: BrowserIssue[]) {
  expect(issues, issues.map((issue) => `[${issue.type}] ${issue.message}`).join('\n')).toEqual([]);
}

export async function login(page: Page, email: string, password: string, client = false) {
  await page.goto(client ? '/client/login' : '/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export function requiredCredentials(prefix: 'ADMIN' | 'SELLER' | 'CLIENT') {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Configure as credenciais E2E de ${prefix}.`);
  return { email, password };
}

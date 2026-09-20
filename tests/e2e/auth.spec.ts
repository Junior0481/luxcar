import { expect, test } from '@playwright/test';

test('exibe os campos acessíveis do login interno', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Entrar na loja' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('abre o estoque público e seus filtros', async ({ page }) => {
  await page.goto('/estoque');
  await expect(page.getByRole('heading', { name: /Encontre o carro certo/i })).toBeVisible();
  await expect(page.getByLabel('Buscar veículos por marca ou modelo')).toBeVisible();
});

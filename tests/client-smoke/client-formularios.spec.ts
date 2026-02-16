import { expect, test } from '@playwright/test';

type ResourceIssue = {
  type: 'requestfailed' | 'badstatus';
  url: string;
  detail: string;
};

test.describe('client legacy smoke', () => {
  const pages = [
    { path: '/practica_01.html', title: 'Práctica 01' },
    { path: '/practica_02.html', title: 'Práctica 01' },
    { path: '/practica_03.html', title: 'Práctica 03' },
    { path: '/practica_04.html', title: 'Práctica 04' }
  ] as const;

  for (const item of pages) {
    test(`carga recursos correctamente: ${item.path}`, async ({ page }) => {
      const issues: ResourceIssue[] = [];

      page.on('requestfailed', (request) => {
        issues.push({
          type: 'requestfailed',
          url: request.url(),
          detail: request.failure()?.errorText ?? 'unknown'
        });
      });

      page.on('response', (response) => {
        if (response.status() >= 400) {
          issues.push({
            type: 'badstatus',
            url: response.url(),
            detail: `status ${response.status()}`
          });
        }
      });

      const response = await page.goto(item.path, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(new RegExp(item.title, 'i'));
      expect(issues).toEqual([]);
    });
  }

  test('practica_02 permite alta de pregunta', async ({ page }) => {
    await page.goto('/practica_02.html', { waitUntil: 'domcontentloaded' });

    await page.fill('#textoPregunta', '¿Qué protocolo usa HTTPS por defecto?');
    await page.fill('#textoRespuesta', 'TLS');

    await expect(page.locator('#btnAgregarRespuesta')).toBeEnabled();
    await page.click('#btnAgregarRespuesta');

    await expect(page.locator('#listaPreguntas li')).toHaveCount(1);
    await expect(page.locator('#listaPreguntas li').first()).toContainText('https por defecto');
  });

  test('practica_04 permite crear y editar reactivo', async ({ page }) => {
    await page.goto('/practica_04.html', { waitUntil: 'domcontentloaded' });

    await page.fill('#textoPregunta', '¿Cuál es el puerto por defecto de HTTP?');
    await page.fill('#textoRespuesta', '80');

    await expect(page.locator('#btnGuardar')).toBeEnabled();
    await page.click('#btnGuardar');

    await expect(page.locator('#listaReactivos li')).toHaveCount(1);
    await expect(page.locator('#listaReactivos li').first()).toContainText('puerto por defecto de HTTP');

    await page.click('button[data-accion="editar"][data-indice="0"]');
    await page.fill('#textoRespuesta', '8080');
    await page.click('#btnGuardar');

    await expect(page.locator('#listaReactivos li').first()).toContainText('8080');
  });
});

import { expect, test } from '@playwright/test';

for (const width of [375, 768, 1280]) {
  test(
    `the dashboard stays usable at ${width}px in both color modes`,
    /** Exercises keyboard login, real rendering, and layout without mocking the API. */
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      const login = page.getByRole('button', { name: 'user1', exact: true });
      await login.focus();
      await expect(login).toBeFocused();
      await login.press('Enter');
      await expect(page.getByRole('heading', { name: 'Work items', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Switch demo account' })).toBeVisible();
      await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();

      const dimensions = await page.evaluate(
        /** Measures page overflow separately from the table's own scroll area. */
        () => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }),
      );
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();
    },
  );
}

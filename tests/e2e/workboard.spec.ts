import { expect, test } from '@playwright/test';

import { selectAccount } from '../../apps/app/test/demo-account';

for (const width of [375, 768, 1280]) {
  test(
    `the dashboard stays usable at ${width}px in both color modes`,
    /** Exercises keyboard login, real rendering, and layout without mocking the API. */
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      await selectAccount(page, 'user1');
      await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Group by', exact: true })).toBeInViewport();
      await expect(page.getByRole('switch', { name: 'Infinite scroll', exact: true })).toBeInViewport();
      await expect(page.getByRole('combobox', { name: 'Switch demo account' })).toBeVisible();
      await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();

      const footerOffset = await page.locator('footer').evaluate(
        /** Measures the footer against the viewport after entering the full-page layout. */
        (footer) => Math.abs(window.innerHeight - footer.getBoundingClientRect().bottom),
      );
      expect(footerOffset).toBeLessThanOrEqual(1);
      const dimensions = await page.evaluate(
        /** Measures page overflow separately from the table's own scroll area. */
        () => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }),
      );
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      if (width < 1024) {
        await page.getByRole('button', { name: 'Open sidebar' }).click();
        const documentation = page.getByRole('navigation', { name: 'Documentation' });
        await expect(documentation.getByRole('link', { name: 'API reference' })).toBeInViewport();
        await expect(documentation.getByRole('link', { name: 'Querry Kit docs' })).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(documentation).toBeHidden();
      }
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();
    },
  );
}

test(
  'toolbar controls use labeled dialogs with a close action on small screens',
  /** Covers keyboard activation and focus return for each mobile toolbar dialog. */
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 550 });
    await page.goto('/tasks');
    await selectAccount(page, 'user1');

    for (const title of ['Group by', 'Sort', 'Filter', 'Table options']) {
      const trigger = page.getByRole('button', { name: title, exact: true });
      await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await trigger.press('Enter');

      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      const body = dialog.locator('[data-slot="body"]');
      await expect(body).toHaveCSS('overflow-y', 'auto');
      const close = dialog.locator('[data-slot="footer"]').getByRole('button', { name: 'Close', exact: true });
      await expect(close).toBeInViewport();
      await close.press('Space');

      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  },
);

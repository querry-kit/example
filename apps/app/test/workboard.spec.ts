import { expect, test, type Page } from '@playwright/test';

/** Signs in from the visible persona picker using the keyboard. */
async function openWorkboard(page: Page): Promise<void> {
  await page.goto('/');
  const account = page.getByRole('button', { name: 'user1', exact: true });
  await account.focus();
  await account.press('Enter');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();
}

test(
  'uses the read dashboard to page, sort, filter, configure columns, and open details',
  /** Uses the real Nuxt UI controls and the seeded database. */
  async ({ page }) => {
    await openWorkboard(page);
    await expect(page.getByRole('columnheader', { name: 'Internal note', exact: true })).toHaveCount(0);
    await expect(page.getByText('Review navigation labels', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Showing 3–4 of 6')).toBeVisible();
    await expect(page.getByText('Check colour contrast', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sort', exact: true }).click();
    const sort = page.getByRole('dialog', { name: 'Sort', exact: true });
    await sort.getByRole('combobox', { name: 'Select field' }).click();
    await page.getByRole('option', { name: 'Est. hours' }).click();
    await page.getByRole('button', { name: 'Add sort' }).click();
    await sort.getByRole('combobox', { name: 'Select field' }).click();
    await page.getByRole('option', { name: 'Title', exact: true }).click();
    await page.getByRole('button', { name: 'Add sort' }).click();
    await page.getByRole('button', { name: 'Sort', exact: true }).click();
    await expect(page.getByText('Measure card spacing', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const filter = page.getByRole('dialog', { name: 'Filter', exact: true });
    await filter.getByRole('combobox', { name: 'Select field' }).click();
    await page.getByRole('option', { name: 'Est. hours' }).click();
    await page.getByRole('button', { name: 'Add filter' }).click();
    await expect(page.getByText('No matching work items')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('button', { name: 'Filter', exact: true }).click();

    const project = page.getByRole('button', { name: 'Project', exact: true });
    await project.click();
    await page.getByRole('option', { name: 'Design', exact: true }).click();
    await expect(page).toHaveURL(/\?project=design$/);
    await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
    await page.reload();
    await expect(project).toContainText('Design');

    await page.getByRole('button', { name: 'Table options' }).click();
    await page
      .getByRole('listitem')
      .filter({ hasText: /^Priority$/ })
      .getByRole('switch', { name: 'Toggle column visibility' })
      .click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Priority', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Open Review detail layout' }).click();
    await expect(page.getByRole('heading', { name: 'Review detail layout' })).toBeVisible();
    await expect(page.getByText('Avery Lane', { exact: true }).first()).toBeVisible();
  },
);

test(
  'renders a recoverable error before loading the real list',
  /** Injects one HTTP failure to distinguish retry state from a real empty response. */
  async ({ page }) => {
    await page.route(
      '**/api/work-items?*',
      /** Fails one list request while leaving session and subsequent list requests real. */
      async (route) => {
        await route.fulfill({
          status: 503,
          json: { statusCode: 503, message: 'Temporary test failure.' },
        });
      },
      { times: 1 },
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'user1', exact: true }).click();
    await expect(page.getByText('Could not load work items')).toBeVisible();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('Showing 1–2 of 6')).toBeVisible();
  },
);

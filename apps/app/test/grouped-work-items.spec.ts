import { expect, test, type Page } from '@playwright/test';

/** Opens the grouped view with a real signed demo session. */
async function openGroups(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'user1', exact: true }).click();
  await page.getByRole('link', { name: 'Groups', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grouped work items' })).toBeVisible();
}

test(
  'loads groups and leaf pages lazily, with optional metrics for the whole filtered branch',
  /** Compares visible rows, group counts and metric totals against PostgreSQL fixtures. */
  async ({ page }) => {
    let metricRequests = 0;
    page.on(
      'request',
      /** Counts metric requests separately from ordinary grouping requests. */
      (request) => {
        if (new URL(request.url()).pathname === '/api/work-items/aggregate') metricRequests++;
      },
    );
    await openGroups(page);
    const open = page.getByRole('button', { name: 'OPEN 2 items', exact: true });
    await expect(open).toBeVisible();
    await expect(page.getByRole('button', { name: 'DONE 2 items', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(page.getByRole('button', { name: 'DONE 2 items', exact: true })).toBeVisible();

    await open.click();
    const group = open.locator('..');
    await expect(group.getByRole('link', { name: 'Review navigation labels' })).toBeVisible();
    await expect(group.getByRole('link', { name: 'Sketch an empty state' })).toHaveCount(0);
    expect(metricRequests).toBe(0);
    await group.getByRole('button', { name: 'Next page' }).click();
    await expect(group.getByRole('link', { name: 'Sketch an empty state' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Load group records' }).click();
    await page.getByRole('option', { name: 'Load more', exact: true }).click();
    await expect(group.getByRole('link', { name: 'Review navigation labels' })).toBeVisible();
    await group.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(group.getByRole('link', { name: 'Sketch an empty state' })).toBeVisible();

    await page.getByRole('switch', { name: 'Show effort metrics' }).click();
    await expect(group.getByText('Total', { exact: true }).locator('..')).toContainText('8');
    await expect(group.getByText('Average', { exact: true }).locator('..')).toContainText('4');
    expect(metricRequests).toBe(1);
    await page.getByRole('textbox', { name: 'Search grouped work items' }).fill('Sketch');
    const filtered = page.getByRole('button', { name: 'OPEN 1 items', exact: true });
    await filtered.click();
    await expect(filtered.locator('..').getByText('Total', { exact: true }).locator('..')).toContainText('6');

    await page.getByRole('combobox', { name: 'Switch demo account' }).click();
    await page.getByRole('option', { name: 'user2', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Switch demo account' })).toContainText('user2');
    await page.getByRole('link', { name: 'Groups', exact: true }).click();
    await open.click();
    await expect(group.getByText('Total', { exact: true })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Show effort metrics' }).click();
    await expect(group.getByText('Total', { exact: true }).locator('..')).toContainText('12');
  },
);

test(
  'adds and reorders grouping keys and retries a failed child branch',
  /** Injects one failed child request while keeping real responses for all other operations. */
  async ({ page }) => {
    let failed = false;
    await page.route(
      '**/api/work-items/group-by?*',
      /** Intercepts only the first group query for the second level. */
      async (route) => {
        if (!failed && new URL(route.request().url()).searchParams.get('by[0]') === 'priority') {
          failed = true;
          await route.fulfill({ status: 503, json: { statusCode: 503, message: 'Temporary grouping error.' } });
        } else {
          await route.continue();
        }
      },
    );
    await openGroups(page);
    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    await page.getByRole('combobox', { name: 'Select grouping field' }).click();
    await page.getByRole('option', { name: 'Priority', exact: true }).click();
    await page.getByRole('button', { name: 'Add grouping' }).click();
    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    const open = page.getByRole('button', { name: 'OPEN 2 items', exact: true });
    await open.click();
    const branch = open.locator('..');
    await expect(branch.getByText('Unable to load group.')).toBeVisible();
    await branch.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(branch.getByRole('button', { name: 'HIGH 1 items', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    await page.getByRole('button', { name: 'Reorder Priority' }).press('ArrowUp');
    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    await expect(page.getByRole('button', { name: 'LOW 2 items', exact: true })).toBeVisible();
  },
);

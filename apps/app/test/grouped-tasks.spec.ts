import { expect, test, type Page } from '@playwright/test';

import { selectAccount } from './demo-account';
import { addProjectFilter, openTaskFilters } from './task-filters';

/** Opens the grouped view with a real signed demo session. */
async function openGroups(page: Page): Promise<void> {
  await page.goto('/');
  await selectAccount(page, 'user1');
  await groupByStatus(page);
}

/** Enables the primary grouping on the Tasks toolbar. */
async function groupByStatus(page: Page): Promise<void> {
  const groupBy = page.getByRole('button', { name: 'Group by', exact: true });
  await groupBy.click();
  await page.getByRole('combobox', { name: 'Select grouping field' }).click();
  await page.getByRole('option', { name: 'Status', exact: true }).click();
  await page.getByRole('button', { name: 'Add grouping' }).click();
  await groupBy.click();
}

/** Reads the visible header coordinates to detect layout shifts. */
function headerGeometry(cells: Element[]): number[][] {
  return cells.map(
    /** Measures each column's position and width. */ (cell) => {
      const { x, width } = cell.getBoundingClientRect();
      return [x, width];
    },
  );
}

test(
  'expands and collapses all nested groups from the footer',
  /** Exercises bulk disclosure, its persisted state and the footer positions. */
  async ({ page }) => {
    await page.setViewportSize({ width: 1445, height: 1143 });
    await openGroups(page);
    const groupBy = page.getByRole('button', { name: 'Group by', exact: true });
    await groupBy.click();
    await page.getByRole('combobox', { name: 'Select grouping field' }).click();
    await page.getByRole('option', { name: 'Priority', exact: true }).click();
    await page.getByRole('button', { name: 'Add grouping' }).click();
    await groupBy.click();

    const expand = page.getByRole('button', { name: 'Expand all groups', exact: true });
    const collapse = page.getByRole('button', { name: 'Collapse all groups', exact: true });
    const effort = page.getByRole('switch', { name: 'Show effort metrics' });
    await expect(expand).toBeEnabled();
    const expandPosition = await expand.boundingBox();
    const effortPosition = await effort.boundingBox();
    expect(expandPosition?.x).toBeLessThan(effortPosition?.x ?? 0);

    const table = page.getByRole('table');
    const headers = table.getByRole('columnheader');
    const collapsedGeometry = await headers.evaluateAll(headerGeometry);
    await expand.click();
    await expect(collapse).toBeEnabled();
    await expect(table.getByRole('button', { name: / \d+ items$/, expanded: false })).toHaveCount(0);
    await expect(table.getByRole('link', { name: /^Open / })).toHaveCount(6);
    expect(await headers.evaluateAll(headerGeometry)).toEqual(collapsedGeometry);
    const group = table
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'OPEN 2 items', exact: true }) });
    expect(
      await group.evaluate(
        /** Checks the complete row, including pinned selection, against its background. */ (row) =>
          [...row.children].every(
            /** The pinned cell should have the same color as its neighboring cells. */ (cell) =>
              getComputedStyle(cell).backgroundColor === getComputedStyle(row).backgroundColor,
          ),
      ),
    ).toBe(true);
    await page.reload();
    await expect(collapse).toBeEnabled();
    await expect(table.getByRole('link', { name: /^Open / })).toHaveCount(6);
    await collapse.click();
    await expect(expand).toBeEnabled();
    await expect(table.getByRole('button', { name: / \d+ items$/, expanded: true })).toHaveCount(0);
    await page.reload();
    await expect(expand).toBeEnabled();
    await expect(table.getByRole('link', { name: /^Open / })).toHaveCount(0);
  },
);

test(
  'restores expanded and collapsed groups after reload and navigation',
  /** Verifies that the browser persists expansion without applying it to a different account. */
  async ({ page }) => {
    await openGroups(page);
    const open = page.getByRole('button', { name: 'OPEN 2 items', exact: true });
    const done = page.getByRole('button', { name: 'DONE 2 items', exact: true });
    await open.click();
    await done.click();
    await done.click();
    await page.reload();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(done).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: 'Open Sketch an empty state' })).toBeVisible();

    await page.getByRole('link', { name: 'Projects', exact: true }).click();
    await page.getByRole('link', { name: 'Tasks', exact: true }).click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await selectAccount(page, 'user2');
    await groupByStatus(page);
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await selectAccount(page, 'user1');
    await expect(open).toHaveAttribute('aria-expanded', 'true');
  },
);

test(
  'keeps group pagination in view and toggles the group from any cell on narrow screens',
  /** Verifies pagination bounds with real horizontal overflow and preserves the keyboard disclosure. */
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.goto('/tasks');
    const nextTaskPage = page.getByRole('button', { name: 'Next page' });
    await expect(nextTaskPage).toBeVisible();
    const regularButton = await nextTaskPage.boundingBox();
    await groupByStatus(page);
    const viewport = page.getByRole('region', { name: 'Tasks table' });
    const open = page.getByRole('button', { name: 'OPEN 5 items', exact: true });
    await expect(open).toBeVisible();
    const group = viewport.getByRole('row').filter({ has: open });
    await group.getByRole('cell').nth(2).click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    const next = viewport.getByRole('button', { name: 'Next page' });
    await expect(next).toBeInViewport();
    const groupedButton = await next.boundingBox();
    expect(groupedButton?.height).toBeLessThan(regularButton?.height ?? 0);
    await viewport.evaluate(
      /** Scrolls the columns independently of the pagination. */ (element) => {
        element.scrollLeft = element.scrollWidth;
      },
    );
    await expect(next).toBeInViewport();
    let releasePage!: () => void;
    const responseGate = new Promise<void>(
      /** Lets the test inspect the previous rows before the server reply arrives. */ (resolve) =>
        (releasePage = resolve),
    );
    const pageRequests: string[] = [];
    page.on(
      'request',
      /** Tracks table requests made during the page change. */ (request) => {
        const { pathname } = new URL(request.url());
        if (pathname === '/api/tasks' || pathname === '/api/tasks/group-by') pageRequests.push(pathname);
      },
    );
    await page.route(
      '**/api/tasks?*',
      /** Delays the requested page without replacing the live response. */ async (route) => {
        if (new URL(route.request().url()).searchParams.get('page') === '2') await responseGate;
        await route.continue();
      },
    );
    await next.click();
    await expect(viewport.locator('footer[aria-busy="true"]')).toHaveCount(1);
    await expect(viewport.getByRole('link', { name: 'Open Audit default projections' })).toBeVisible();
    await expect(viewport.getByText('Showing 1–2 of 5')).toBeVisible();
    releasePage();
    await expect(viewport.getByText('Showing 3–4 of 5')).toBeVisible();
    expect(pageRequests).toEqual(['/api/tasks']);
    await open.press('Space');
    await expect(open).toHaveAttribute('aria-expanded', 'false');

    const status = viewport.getByRole('columnheader', { name: 'Status', exact: true });
    await status.getByRole('button').click();
    await status.getByRole('button').click();
    await expect(status).toHaveAttribute('aria-sort', 'descending');
    await expect(viewport.getByRole('rowgroup').last().getByRole('row').first()).toContainText('ARCHIVED');
  },
);

test(
  'loads groups and leaf pages lazily, with optional metrics for the whole filtered branch',
  /** Compares visible rows, group counts and metric totals against PostgreSQL fixtures. */
  async ({ page }) => {
    let metricRequests = 0;
    page.on(
      'request',
      /** Counts metric requests separately from ordinary grouping requests. */
      (request) => {
        if (new URL(request.url()).pathname === '/api/tasks/aggregate') metricRequests++;
      },
    );
    await openGroups(page);
    const open = page.getByRole('button', { name: 'OPEN 2 items', exact: true });
    const table = page.getByRole('table');
    await expect(table).toHaveCount(1);
    await expect(
      table.getByRole('columnheader').first().getByRole('checkbox', { name: 'Select visible tasks' }),
    ).toBeDisabled();
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('Status');
    const group = table.getByRole('row').filter({ has: open });
    await expect(open).toBeVisible();
    await expect(group.getByLabel('Total estimated hours')).toHaveText('8');
    await expect(page.getByRole('link', { name: 'Open Review navigation labels' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'DONE 2 items', exact: true })).toBeVisible();

    await open.click();
    await table.getByRole('combobox').click();
    await page.getByRole('option', { name: '1', exact: true }).click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(table.getByRole('link', { name: 'Open Review navigation labels' })).toBeVisible();
    await expect(table.getByRole('link', { name: 'Open Sketch an empty state' })).toHaveCount(0);
    const selectOpen = table.getByRole('checkbox', { name: 'Select group OPEN 2 items' });
    await table.getByRole('checkbox', { name: 'Select Review navigation labels' }).click();
    await expect(selectOpen).toHaveAttribute('aria-checked', 'mixed');
    const selectionReads: string[] = [];
    const captureRead = /** Records any task-list request made while selecting the group. */ (
      request: import('@playwright/test').Request,
    ) => {
      if (new URL(request.url()).pathname === '/api/tasks') selectionReads.push(request.url());
    };
    page.on('request', captureRead);
    await selectOpen.click();
    await expect(page.getByRole('button', { name: 'Delete selected (2)' })).toBeVisible();
    await expect(selectOpen).toBeChecked();
    page.off('request', captureRead);
    expect(selectionReads).toEqual([]);
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(metricRequests).toBe(0);
    await table.getByRole('button', { name: 'Next page' }).click();
    await expect(table.getByRole('link', { name: 'Open Sketch an empty state' })).toBeVisible();
    await expect(table.getByRole('checkbox', { name: 'Select Sketch an empty state' })).toBeChecked();
    await selectOpen.click();
    await expect(table.getByRole('checkbox', { name: 'Select Sketch an empty state' })).not.toBeChecked();

    await page.getByRole('switch', { name: 'Infinite scroll', exact: true }).click();
    await expect(table.getByRole('link', { name: 'Open Review navigation labels' })).toBeVisible();
    await expect(table.getByRole('link', { name: 'Open Sketch an empty state' })).toBeVisible();

    await page.getByRole('switch', { name: 'Show effort metrics' }).click();
    await expect(table.getByText('Total', { exact: true }).locator('..')).toContainText('8');
    await expect(table.getByText('Average', { exact: true }).locator('..')).toContainText('4');
    expect(metricRequests).toBe(1);
    const filters = await openTaskFilters(page);
    const project = await addProjectFilter(filters);
    await project.click();
    await page.getByRole('option', { name: 'Design', exact: true }).click();
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const filtered = page.getByRole('button', { name: 'OPEN 1 items', exact: true });
    await expect(table.getByRole('row').filter({ has: filtered }).getByLabel('Total estimated hours')).toHaveText('6');
    await expect(filtered).toHaveAttribute('aria-expanded', 'true');
    await expect(table.getByText('Total', { exact: true }).locator('..')).toContainText('6');

    await selectAccount(page, 'user2');
    await groupByStatus(page);
    await open.click();
    await expect(table.getByText('Total', { exact: true })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Show effort metrics' }).click();
    await expect(table.getByText('Total', { exact: true }).locator('..')).toContainText('12');
  },
);

test(
  'adds and reorders grouping keys and retries a failed child branch',
  /** Injects one failed child request while keeping real responses for all other operations. */
  async ({ page }) => {
    let failed = false;
    await page.route(
      '**/api/tasks/group-by?*',
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
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('Status');
    await expect(table.getByRole('columnheader').nth(2)).toHaveText('Priority');
    await expect(table.getByText('Unable to load group.')).toBeVisible();
    await table.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(table.getByRole('button', { name: 'HIGH 1 items', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    await page.getByRole('button', { name: 'Reorder Priority' }).press('ArrowUp');
    await page.getByRole('button', { name: 'Group by', exact: true }).click();
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('Priority');
    await expect(table.getByRole('columnheader').nth(2)).toHaveText('Status');
    await expect(table.getByRole('button', { name: 'LOW 2 items', exact: true })).toBeVisible();
  },
);

test(
  'redirects old Groups bookmarks to Tasks and retains the project filter',
  /** Opens the former route through Nuxt and verifies that the duplicate navigation entry is gone. */
  async ({ page }) => {
    await page.goto('/groups?project=design');
    await expect(page).toHaveURL(/\/tasks\?project=design$/);
    const filters = await openTaskFilters(page);
    await expect(filters.getByRole('button', { name: 'Project', exact: true })).toContainText('Design');
    await expect(page.getByRole('link', { name: 'Groups', exact: true })).toHaveCount(0);
  },
);

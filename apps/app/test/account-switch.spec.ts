import { expect, test, type Page } from '@playwright/test';

/** Changes the current account using the navbar's accessible selector. */
async function selectAccount(page: Page, login: 'user1' | 'user2' | 'admin'): Promise<void> {
  await page.getByRole('combobox', { name: 'Switch demo account' }).click();
  await page.getByRole('option', { name: login, exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Switch demo account' })).toContainText(login);
}

/** Holds one real previous-account list response until after the account changes. */
async function holdRead(page: Page) {
  const captured = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route(
    '**/api/work-items?*',
    /** Retrieves the old payload before letting the test switch identities. */
    async (route) => {
      const response = await route.fetch();
      captured.resolve();
      await release.promise;
      await route.fulfill({ response }).catch(
        /** Cancellation of the old request is expected after a switch. */
        () => undefined,
      );
    },
    { times: 1 },
  );
  return { captured: captured.promise, release: release.resolve };
}

test(
  'drops previous-role and same-role list data when switching accounts',
  /** Works with real session cookies and scoped API responses. */
  async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'admin', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Internal note' })).toBeVisible();
    await expect(page.getByText('Audit default projections')).toBeVisible();

    const fromAdmin = await holdRead(page);
    await page.getByRole('textbox', { name: 'Search work items' }).fill('Audit');
    await fromAdmin.captured;
    await selectAccount(page, 'user1');
    fromAdmin.release();
    await expect(page.getByText('Sketch an empty state')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Internal note' })).toHaveCount(0);
    await expect(page.getByText('Audit default projections')).toHaveCount(0);

    const fromUser1 = await holdRead(page);
    await page.getByRole('textbox', { name: 'Search work items' }).fill('Sketch');
    await fromUser1.captured;
    await selectAccount(page, 'user2');
    fromUser1.release();
    await expect(page.getByText('Draft filter reference')).toBeVisible();
    await expect(page.getByText('Sketch an empty state')).toHaveCount(0);

    await page.getByRole('link', { name: 'Open Draft filter reference' }).click();
    await expect(page.getByRole('heading', { name: 'Draft filter reference' })).toBeVisible();
    await selectAccount(page, 'user1');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Sketch an empty state')).toBeVisible();
    await expect(page.getByText('Draft filter reference')).toHaveCount(0);
  },
);

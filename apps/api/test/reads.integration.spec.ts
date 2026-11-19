import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApiClient, useModuleApi, type EndpointDefinition } from '@querry-kit/nuxt';
import {
  demoSessionSchema,
  labelLookupPageSchema,
  projectLookupPageSchema,
  workItemPageSchema,
  workItemSchema,
  type DemoSession,
  type WorkItem,
} from '@workboard/contracts';

import { createWorkboardAbility } from '../src/auth/workboard-ability.js';
import { DatabaseService } from '../src/database/database.service.js';
import { createScopedQuery } from '../src/query/scoped-query.js';

const api = process.env.WORKBOARD_TEST_API_URL ?? 'http://127.0.0.1:35463';
const origin = process.env.WORKBOARD_TEST_APP_ORIGIN ?? 'http://127.0.0.1:3201';

/** Read-only endpoint mapping used with the real package serializer. */
type Endpoints = { 'work-items': EndpointDefinition<WorkItem, never, never> };

/** Selects a seeded account and returns the actual session cookie and validated identity. */
async function signIn(login: DemoSession['login']) {
  const response = await fetch(`${api}/api/demo/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ login }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return { cookie, session: demoSessionSchema.parse(await response.json()) };
}

/** Sends a real authenticated read request and checks its expected status. */
async function request(path: string, cookie: string, status = 200) {
  const response = await fetch(`${api}${path}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, status, `${path}: ${response.status === status ? '' : await response.text()}`);
  return response;
}

test(
  'validated scopes, projections, lookup hydration, and client serialization agree',
  /** Exercises the seeded Nest/Fastify and Prisma stack, not a mocked transport. */
  async () => {
    const user = await signIn('user1');
    const admin = await signIn('admin');
    assert.equal((await fetch(`${api}/api/work-items`)).status, 401);

    const axios = createApiClient({ apiBaseUrl: api });
    // This example's contract is unversioned. On `/api/v1`, keep the package client's default URL.
    axios.defaults.baseURL = `${api}/api`;
    axios.defaults.headers.common.Cookie = user.cookie;
    const workItems = useModuleApi<Endpoints, 'work-items'>(axios, 'work-items');
    const first = workItemPageSchema.parse(
      (
        await workItems.query({
          where: { AND: [{ project: { id: 'shared' } }, { estimatedHours: { gte: 1 } }] },
          orderBy: [{ estimatedHours: 'asc' }, { title: 'desc' }],
          fields: 'id,project{title},owner{profile},labels{displayName}',
          page: 1,
          perPage: 1,
        })
      ).data,
    );
    assert.equal(first.meta.itemCount, 3);
    assert.equal(first.items[0]?.id, 'u1-5');
    assert.deepEqual(first.items[0]?.project, { title: 'Workboard' });
    assert.deepEqual(first.items[0]?.owner, { profile: { displayName: 'Avery Lane' } });
    assert.equal((await workItems.count({ where: { status: 'OPEN' } })).data, 2);

    const sorted = workItemPageSchema.parse(
      (
        await workItems.query({
          where: JSON.stringify({ status: 'OPEN' }),
          orderBy: JSON.stringify([{ estimatedHours: 'desc' }]),
        })
      ).data,
    );
    assert.equal(sorted.items[0]?.id, 'u1-2');

    const detail = workItemSchema.parse((await workItems.findById('u1-1')).data);
    assert.equal(detail.assignee, null);
    assert.deepEqual(detail.labels?.map(/** Reads public label names. */ ({ displayName }) => displayName).sort(), [
      'Review',
      'UX',
    ]);
    assert.equal('internalNote' in detail, false);
    assert.equal(detail.owner?.profile?.displayName, 'Avery Lane');
    const projectedAdmin = await request('/api/work-items/a6?fields=internalCostCents', admin.cookie);
    assert.deepEqual(workItemSchema.parse(await projectedAdmin.json()), { internalCostCents: 98_765 });
    for (const route of ['/api/work-items/u2-1', '/api/work-items/find-by-id/u2-1', '/api/work-items/missing']) {
      await request(route, user.cookie, 404);
    }
    for (const query of ['fields=internalNote', 'where[internalCostCents][gte]=1', 'orderBy[internalNote]=asc']) {
      await request(`/api/work-items?${query}`, user.cookie, 403);
    }
    for (const query of ['fields=owner{role}', 'where=%7Bbroken', 'perPage=101', 'include[project]=true']) {
      await request(`/api/work-items?${query}`, user.cookie, 400);
    }

    const projects = await request(
      '/api/projects?where[id][in][0]=shared&where[id][in][1]=docs&perPage=1000',
      user.cookie,
    );
    assert.deepEqual(projectLookupPageSchema.parse(await projects.json()).items, [
      { id: 'shared', slug: 'workboard', title: 'Workboard' },
    ]);
    await request('/api/projects?perPage=1000', user.cookie, 400);
    const labels = labelLookupPageSchema.parse(await (await request('/api/labels', user.cookie)).json());
    assert.deepEqual(
      labels.items.map(/** Uses stable lookup IDs rather than translated labels. */ ({ id }) => id),
      ['review', 'ux'],
    );

    const doc = await (await request('/docs/openapi.json', user.cookie)).json();
    const operation = doc.paths['/api/work-items'].get;
    assert.equal(operation['x-normalized-query'].properties.fields.type, 'string');
    assert.equal(operation.responses['200'].content['application/json'].schema.properties.items.type, 'array');
    assert.ok(operation.responses['403']);

    const database = new DatabaseService();
    try {
      const service = createScopedQuery(database.workItem, 'WorkItem');
      const ability = createWorkboardAbility(user.session);
      const one = await service.findOne<{ id: string }>({ where: { id: 'u1-1' } }, ability);
      assert.equal(one?.id, 'u1-1');
      await assert.rejects(service.findUnique({ where: { id: 'u2-1' } }, ability), { status: 404 });
      assert.equal((await service.findMany({ where: {} }, ability)).length, 6);
    } finally {
      await database.$disconnect();
    }
  },
);

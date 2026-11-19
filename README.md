# Querry Kit Workboard

A reference workspace for a NestJS/Fastify API and Nuxt 4 dashboard using Querry Kit. It uses a shared Zod contracts package.

## Try the standalone demo

From a checkout of this repo with Docker Compose and network access:

```sh
docker compose up -d --build --wait
```

Open `http://127.0.0.1:3201`, select a demo account, or open `http://127.0.0.1:3201/docs` for the API reference. The stack runs PostgreSQL, Fastify and Nuxt; only the Nuxt port is exposed on loopback. No sibling checkouts or host Node/pnpm installation are needed. Set `WORKBOARD_APP_PORT` to use a different host port and open the matching `127.0.0.1` URL.

Use `docker compose down` to stop the stack while retaining the data. A normal restart does not add or overwrite fixtures.

## Bootstrap

Install Node.js 26.13.0 or a newer Node 26 patch, pnpm 11.28.9, and Git. Then run:

```sh
node scripts/stage-querry-kit.mjs
pnpm install --frozen-lockfile
pnpm build
```

Staging runs before the package manager because the workspace dependencies must exist before installation. It fetches the exact revisions in `scripts/querry-kit-sources.json` into the ignored `vendor/` directory. The example imports them via pnpm `workspace:` dependencies; it does not download Querry Kit packages from npm. Do not place personal checkouts in `vendor/`.

See the [Querry Kit documentation](https://querry-kit.github.io/querry-kit/) for package APIs.

Contributors: see the [coding guidelines](docs/coding-guidelines.md) for check and format commands.

## Start the API locally

After bootstrap, start the local database and the built API:

```sh
docker compose -f compose.dev.yml up -d --wait
pnpm --filter @workboard/api start
```

Only PostgreSQL runs in the development Compose file. The API applies the checked-in migration and seeds the database only when all application tables are empty. It listens on `127.0.0.1:3101` by default; `GET /api/health/ready` confirms initialization. To change the database connection, set `DATABASE_URL` for the API and Prisma CLI.

## Demo accounts

Select `user1`, `user2`, or `admin` without a password. The two regular accounts share a role but have different ownership scopes. Only `admin` can read internal notes and costs.

Use **Switch demo account** in the dashboard navbar. Switching closes details, clears the active project filter, and cancels reads from the previous account. Try the shared Workboard project under both regular accounts: they get different work-item IDs despite having the same role.

```sh
curl --fail --cookie-jar workboard.cookies \
  -H 'Origin: http://127.0.0.1:3201' -H 'Content-Type: application/json' \
  --data '{"login":"user1"}' http://127.0.0.1:3101/api/demo/session
```

`DEMO_ORIGIN` controls the exact browser origin accepted by the API. The session expires in 30 minutes and is invalidated on each API restart unless `DEMO_SESSION_SECRET` is configured. Passwordless persona selection is for synthetic local data only, not for production.

### Read a projected list

With the cookie from the previous request, ask for public fields on open work items and a nested project title:

```sh
curl --fail --cookie workboard.cookies --get \
  --data-urlencode 'where={"status":"OPEN"}' \
  --data-urlencode 'fields=id,title,project{title}' \
  --data-urlencode 'perPage=10' http://127.0.0.1:3101/api/work-items
```

As `user1`, the list contains `u1-1` and `u1-2` with `meta.itemCount: 2`. `GET /api/work-items/count` returns the count as a JSON number. Use `/docs` to explore projections, lookups, and the validated query shapes.

### Read groups and metrics

Grouping returns only group keys unless you opt in to metrics. For example, request the two-level combination of status and priority, plus counts and estimated hours:

```sh
curl --fail --cookie workboard.cookies --get \
  --data-urlencode 'by[0]=status' --data-urlencode 'by[1]=priority' \
  --data-urlencode '_count[_all]=true' --data-urlencode '_sum[estimatedHours]=true' \
  http://127.0.0.1:3101/api/work-items/group-by
```

`GET /api/work-items/aggregate` accepts the same `where` filter and metric selectors without `by`. Both endpoints apply the active account's CASL scope before the database computes results.

In the dashboard, select **Groups**. Add a second grouping key, expand a branch, and optionally turn on **Show effort metrics**. Switch between page buttons and incremental loading to compare both ways of fetching group rows. The count and metrics include every matching authorized row, even when only one row has been loaded.

### Open the dashboard

With the local API running, start the Nuxt app:

```sh
pnpm --filter @workboard/app dev
```

Open `http://127.0.0.1:3201`, select `user1`, and explore the two-row pages. The work item toolbar provides search, structured filters, multi-sort, and column options. The project picker searches scoped server results and restores the selected project when you reload its URL. Open a row to see its projected details.

The Nuxt server forwards `/api` and `/docs` to `NUXT_API_ORIGIN` (default `http://127.0.0.1:3101`). The browser always uses the Nuxt origin so the demo cookie can remain HttpOnly without a CORS setup.

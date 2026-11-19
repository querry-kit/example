# Querry Kit Workboard

A reference workspace for a NestJS/Fastify API and Nuxt 4 dashboard using Querry Kit. It uses a shared Zod contracts package.

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

```sh
curl --fail --cookie-jar workboard.cookies \
  -H 'Origin: http://127.0.0.1:3201' -H 'Content-Type: application/json' \
  --data '{"login":"user1"}' http://127.0.0.1:3101/api/demo/session
```

`DEMO_ORIGIN` controls the exact browser origin accepted by the API. The session expires in 30 minutes and is invalidated on each API restart unless `DEMO_SESSION_SECRET` is configured. Passwordless persona selection is for synthetic local data only, not for production.

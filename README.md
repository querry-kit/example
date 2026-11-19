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

# Contract: Workboard HTTP API

`/api` is forwarded through the Nuxt origin in development and the test stack; `/docs` and the OpenAPI JSON describe the application-owned contract. The API is authoritative. The browser parses session and query state as well as incoming payloads with shared schemas. Timestamps are ISO 8601 UTC strings and amounts are integer cents; empty aggregate inputs return `null` where Prisma does.

| Method and route | Input | Success |
| --- | --- | --- |
| `POST /api/demo/session` | Strict `{ login: 'user1' \| 'user2' \| 'admin' }`; no client role claim | `200`, public identity and replacement signed HttpOnly session cookie |
| `GET /api/demo/session` | Session cookie | `200`, public identity, allowed fields and query capabilities |
| `GET /api/work-items` | `where`, `orderBy`, `fields`, `page`, `perPage` | `200`, `{ items, meta }`; access-scoped `itemCount` |
| `GET /api/work-items/:id` | Stable ID, optional `fields` | `200`, projected record; unavailable and missing IDs both `404` |
| `GET /api/work-items/find-by-id/:id` | Same detail contract | `200`, same projected record via the route expected by the Nuxt `findById` client |
| `GET /api/work-items/count` | Same supported `where` | `200`, JSON integer, matching Nuxt `useModuleApi().count()` |
| `GET /api/work-items/aggregate` | Same `where`; `_count`, `_sum`, `_avg`, `_min`, `_max` selections | `200`, validated requested metric objects |
| `GET /api/work-items/group-by` | `by`, `where`, `orderBy`, `skip`, `take`, allowed aggregates, `having` for allowed scalars/metrics | `200`, group array with typed keys and `_count._all` when requested |
| `GET /api/projects`, `GET /api/labels` | Bounded lookup query through typed resource client | `200`, scoped paged lookup rows; autocomplete uses Projects |
| `GET /api/health/ready` | None | `200` after schema/seed checks; otherwise unavailable |

Static paths must not resolve as detail IDs. `POST` is only for demo session state; no write routes for domain entities. The cookie has a short expiry, `SameSite` and appropriate local/HTTPS transport settings. Check login origin, keep all demo data private to the local stack by default, and mark session/resource responses `no-store`. Passwordless persona selection is deliberately not production authentication.

## Query conventions

- Match the pinned client serializer: support its nested/bracket keys and JSON `where`, preserve typed values and leading zeros, bound depth/length/complexity, and reject unknown keys and unsafe paths. The Fastify parser and request schemas must agree on coercion.
- Use lists of supported fields/operators rather than forwarding arbitrary Prisma shapes. Include scalar equality/range/text, `AND`/`OR`, project relation filter and label membership; publish actual combinations and examples. No arbitrary `include`, group `select`, or direct Prisma selection/where passthrough.
- Default list sort is stable and an `id` tie-breaker is applied when absent. Cap regular page sizes at 100. For selected-value project lookups, accept the pinned `useAutocomplete` client's `perPage=1000` only with a bounded ID-selection filter and normalize the effective limit to 100. Allow up to two distinct scalar group keys from `status`, `priority`, and admin-only `internalCostCents`, with a bounded `take` that accommodates the client's batch-size-plus-one check. Use stable key ordering across `skip`/`take`. The tree exposes status/priority and requests one key at a time; document a two-key direct query independently.
- Only `admin` can project or query the internal fields. Both `user1` and `user2` have role `user` and can read only rows owned by their own account ID. Reject recognized but forbidden fields as `403`, including nested projections, filter/sort, `by`, `having` and metric operands. Unsupported shapes are `400`. Omit forbidden fields from default results. A valid session is required for all query endpoints (`401` otherwise).
- Apply the same CASL row condition to each list/detail/count/aggregate/group/lookup and constrain referenced relations. Combine it with user predicates via `AND`, not object overwrite; call `QueryService.aggregate` only with an already-scoped `where`. Use strict Zod output schemas for projections, page/group metadata and shared error envelopes; distinguish absent projected properties from nullable values.

## Client state boundary

Remount query state on every account change, including `user1` ↔ `user2`. Namespace stored table settings by account ID, not role. Cancel or ignore stale responses, clear active selections and close details, and render only responses for the active identity. Group metrics share the active identity, full filter and typed branch path; they are neither stored in `GroupNode` nor calculated from paged rows.

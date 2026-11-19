import { createApiClient } from '@querry-kit/nuxt';
import {
  apiErrorSchema,
  demoSessionSchema,
  labelLookupPageSchema,
  projectLookupPageSchema,
  workItemPageSchema,
  workItemSchema,
} from '@workboard/contracts';

export default defineNuxtPlugin(
  /**
   * Configures the shared Query Kit client and validates payloads before any table or lookup can consume them.
   *
   * @see https://querry-kit.github.io/querry-kit/docs/nuxt/api/api/
   */
  () => {
    const api = createApiClient({ apiBaseUrl: useRequestURL().origin });

    // This example exposes `/api` on the Nuxt origin. Keep the package default for a versioned `/api/v1` API.
    api.defaults.baseURL = '/api';
    api.interceptors.response.use(
      /** Validates each known read response by its public route, separate from TypeScript's static types. */
      (response) => {
        const route = response.config.url?.split('?')[0] ?? '';
        if (route === '/demo/session') response.data = demoSessionSchema.parse(response.data);
        if (route === '/work-items') response.data = workItemPageSchema.parse(response.data);
        if (route === '/projects') response.data = projectLookupPageSchema.parse(response.data);
        if (route === '/labels') response.data = labelLookupPageSchema.parse(response.data);
        if (/^\/work-items\/(?:find-by-id\/)?[^/]+$/.test(route) && route !== '/work-items/count') {
          response.data = workItemSchema.parse(response.data);
        }
        return response;
      },
      /** Preserves status while exposing only validated public error messages. */
      (error: unknown) => {
        if (typeof error !== 'object' || !error || !('response' in error)) throw error;
        const response = error.response;
        if (typeof response !== 'object' || !response || !('data' in response)) throw error;
        const payload = apiErrorSchema.safeParse(response.data);
        if (!payload.success) throw error;
        throw Object.assign(new Error(payload.data.message), { statusCode: payload.data.statusCode });
      },
    );

    return { provide: { workboardApi: api } };
  },
);

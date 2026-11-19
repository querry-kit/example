export default defineNuxtConfig({
  // Register Querry Kit after Nuxt UI so the example can use its auto-imported table controls.
  // https://querry-kit.github.io/querry-kit/docs/nuxt-ui/guide/getting-started/
  modules: ['@nuxt/ui', '@querry-kit/nuxt-ui'],
  css: ['~/assets/main.css'],
  compatibilityDate: '2026-11-19',
});

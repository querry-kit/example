<template>
  <UDashboardGroup unit="rem" storage-key="workboard-dashboard">
    <UDashboardSidebar id="workboard-sidebar" collapsible resizable :default-size="15" :min-size="13" :max-size="21">
      <template #header="{ collapsed }">
        <NuxtLink to="/" aria-label="Querry Kit Workboard" class="flex min-w-0 items-center gap-2 font-semibold">
          <UIcon name="i-tabler-layout-kanban" class="size-5 shrink-0 text-primary" />
          <span v-if="!collapsed">Querry Kit Workboard</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu orientation="vertical" :items="navigation" :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel id="workboard-main" :ui="{ body: 'min-w-0' }">
      <template #header>
        <UDashboardNavbar title="Work items">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UBadge v-if="session" color="neutral" variant="soft" :label="session.login" />
            <UColorModeButton />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <p v-if="!checked" role="status" class="text-muted">
          Checking demo session…
        </p>
        <section v-else-if="!session" class="mx-auto w-full max-w-xl space-y-4" aria-labelledby="demo-heading">
          <h1 id="demo-heading" class="text-2xl font-semibold">
            Choose a demo account
          </h1>
          <p class="text-muted">
            These synthetic accounts require no password. Each user sees owned work items; admin sees all items and
            internal fields.
          </p>
          <UAlert v-if="error" color="error" variant="soft" title="Demo session unavailable" :description="error" />
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="login in demoLoginSchema.options"
              :key="login"
              color="neutral"
              variant="outline"
              :disabled="switching"
              :label="login"
              @click="select(login)"
            />
          </div>
        </section>
        <div v-show="checked && session" class="min-w-0">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
import { demoLoginSchema } from '@workboard/contracts';

const { session, checked, switching, error, restore, select } = useDemoSession();
const navigation = [
  { label: 'Work items', icon: 'i-tabler-list-details', to: '/' },
  {
    label: 'API reference',
    icon: 'i-tabler-api',
    to: '/docs',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
  {
    label: 'Querry Kit docs',
    icon: 'i-tabler-book',
    to: 'https://querry-kit.github.io/querry-kit/',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
];

onMounted(restore);
</script>

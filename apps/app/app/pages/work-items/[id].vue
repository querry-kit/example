<template>
  <section class="mx-auto w-full max-w-4xl space-y-4" aria-labelledby="work-item-heading">
    <UButton to="/" icon="i-tabler-arrow-left" color="neutral" variant="ghost" label="Work items" />
    <p v-if="loading" role="status" class="text-muted">
      Loading work item…
    </p>
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      :title="error"
      :actions="[{ label: 'Retry', onClick: load }]"
    />
    <UCard v-else-if="item">
      <template #header>
        <h1 id="work-item-heading" class="text-xl font-semibold">
          {{ item.title }}
        </h1>
        <p class="text-sm text-muted">
          {{ item.id }}
        </p>
      </template>
      <dl class="grid gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase text-muted">
            Project
          </dt>
          <dd>
            {{ item.project?.title ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted">
            Owner
          </dt>
          <dd>
            {{ item.owner?.profile?.displayName ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted">
            Assignee
          </dt>
          <dd>
            {{ item.assignee?.profile?.displayName ?? 'Unassigned' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted">
            Status / priority
          </dt>
          <dd>
            {{ item.status }} / {{ item.priority }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted">
            Estimated hours
          </dt>
          <dd>
            {{ item.estimatedHours }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted">
            Labels
          </dt>
          <dd class="flex flex-wrap gap-1">
            <UBadge
              v-for="label in item.labels"
              :key="label.id"
              color="neutral"
              variant="subtle"
              :label="label.displayName"
            />
          </dd>
        </div>
        <div v-if="item.internalNote !== undefined">
          <dt class="text-xs uppercase text-muted">
            Internal note
          </dt>
          <dd>
            {{ item.internalNote }}
          </dd>
        </div>
        <div v-if="item.internalCostCents !== undefined">
          <dt class="text-xs uppercase text-muted">
            Internal cost (¢)
          </dt>
          <dd>
            {{ item.internalCostCents }}
          </dd>
        </div>
      </dl>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useModuleApi, type EndpointDefinition } from '@querry-kit/nuxt';
import { resourceIdSchema, workItemSchema, type WorkItem } from '@workboard/contracts';

const route = useRoute();
const { $workboardApi } = useNuxtApp();
const { activeSession } = useDemoSession();
const item = shallowRef<WorkItem>();
const error = ref<string>();
const loading = ref(false);
let request = 0;

type DetailEndpoints = { 'work-items': EndpointDefinition<WorkItem, never, never> };
const api = useModuleApi<DetailEndpoints, 'work-items'>($workboardApi, 'work-items');

/** Uses the typed detail client and ignores responses for an older route or session. */
async function load(): Promise<void> {
  const current = ++request;
  error.value = undefined;
  item.value = undefined;
  loading.value = false;
  if (!activeSession.value) return;

  const id = resourceIdSchema.safeParse(route.params.id);
  if (!id.success) {
    error.value = 'Invalid work item ID.';
    return;
  }
  loading.value = true;
  try {
    const response = await api.findById(id.data);
    if (current === request) item.value = workItemSchema.parse(response.data);
  } catch {
    if (current === request) error.value = 'Work item is unavailable.';
  } finally {
    if (current === request) loading.value = false;
  }
}

watch([activeSession, /** Tracks navigation within the same page component. */ () => route.params.id], load);
onMounted(load);
onScopeDispose(
  /** Invalidates in-flight responses when the detail page unmounts. */ () => {
    request++;
  },
);
</script>

<template>
  <p v-if="loading" role="status" class="text-sm text-muted">
    Loading effort metrics…
  </p>
  <div v-else-if="error" role="alert" class="flex items-center gap-2 text-sm text-error">
    <span>Could not load effort metrics.</span>
    <UButton size="xs" variant="link" label="Retry metrics" @click="load" />
  </div>
  <div v-else-if="metrics" class="flex flex-wrap items-center gap-3 rounded-md bg-elevated px-3 py-2 text-sm">
    <p class="font-medium">
      Estimated hours
    </p>
    <dl class="flex flex-wrap gap-3 tabular-nums">
      <div class="flex gap-1">
        <dt>
          Total
        </dt>
        <dd>
          {{ metrics._sum?.estimatedHours ?? '—' }}
        </dd>
      </div>
      <div class="flex gap-1">
        <dt>
          Average
        </dt>
        <dd>
          {{ formatAverage(metrics._avg?.estimatedHours) }}
        </dd>
      </div>
      <div class="flex gap-1">
        <dt>
          Min
        </dt>
        <dd>
          {{ metrics._min?.estimatedHours ?? '—' }}
        </dd>
      </div>
      <div class="flex gap-1">
        <dt>
          Max
        </dt>
        <dd>
          {{ metrics._max?.estimatedHours ?? '—' }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { GroupPath } from '@querry-kit/nuxt';

const props = defineProps<{ path: GroupPath; filter?: Record<string, unknown> }>();
const { metrics, loading, error, load } = useGroupMetrics(
  /** Passes the current ungrouped filter to the scoped metrics adapter. */
  () => props.filter,
  /** Includes every ancestor key. */
  () => props.path,
);

/** Formats a possibly fractional average without treating missing data as zero. */
function formatAverage(value: number | null | undefined): string {
  return value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
</script>

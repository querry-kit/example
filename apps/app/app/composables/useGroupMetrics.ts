import { andWhere, serializeQuery, type GroupPath } from '@querry-kit/nuxt';
import { taskAggregateQuerySchema, type TaskAggregate } from '@workboard/contracts';
import type { MaybeRefOrGetter } from 'vue';

/**
 * Fetches opt-in metrics for one expanded branch, independently of its visible rows.
 *
 * @see https://querry-kit.github.io/querry-kit/docs/nuxt-ui/components/grouping/
 * @see https://querry-kit.github.io/querry-kit/docs/nest/api/query-service/
 */
export function useGroupMetrics(
  filter: MaybeRefOrGetter<Record<string, unknown> | undefined>,
  path: MaybeRefOrGetter<GroupPath>,
) {
  const { $workboardApi } = useNuxtApp();
  const metrics = shallowRef<TaskAggregate>();
  const loading = ref(false);
  const error = ref(false);
  let request = 0;

  /** Combines the same filter and typed branch path that Query Kit sends to load group rows. */
  const query = computed(
    /** Builds but does not send an API metrics request. */
    () => {
      const branch = toValue(path).map(
        /** Adds one equality predicate without converting a numeric group key to text. */
        ({ field, value }) => ({ [field]: { equals: value } }),
      );
      return taskAggregateQuerySchema.parse({
        where: andWhere(toValue(filter), ...branch),
        _sum: { estimatedHours: true },
        _avg: { estimatedHours: true },
        _min: { estimatedHours: true },
        _max: { estimatedHours: true },
      });
    },
  );

  /** Loads a branch's metrics, ignoring results after collapse, filter changes, or unmount. */
  async function load(): Promise<void> {
    const current = ++request;
    loading.value = true;
    error.value = false;
    metrics.value = undefined;
    try {
      const params = query.value;
      const response = await $workboardApi.get<TaskAggregate>(
        `/tasks/aggregate${serializeQuery({ ...params, where: JSON.stringify(params.where ?? {}) })}`,
      );
      if (current === request) metrics.value = response.data;
    } catch {
      if (current === request) error.value = true;
    } finally {
      if (current === request) loading.value = false;
    }
  }

  watch(query, load, { immediate: true });
  onScopeDispose(
    /** Prevents an older request from writing into a collapsed or remounted branch. */
    () => {
      request++;
    },
  );
  return { metrics, loading, error, load };
}

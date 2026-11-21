import type { GroupNode, GroupPath } from '@querry-kit/nuxt';
import { bulkDeleteLimit, taskBulkDeleteSchema, type Task } from '@workboard/contracts';

/** Tracks group selections and only the individual tasks that override them. */
export function useTaskSelection() {
  const groups = shallowReactive(new Map<string, { node: GroupNode<Task>; checked: boolean }>());
  const tasks = shallowReactive(new Map<string, { task: Task; checked: boolean }>());

  /** Uses the closest matching group rule, so subgroup exceptions take precedence. */
  function groupDefault(matches: (path: GroupPath) => boolean): boolean {
    let depth = 0;
    let checked = false;
    for (const rule of groups.values()) {
      const { path } = rule.node;
      if (path.length > depth && matches(path)) {
        depth = path.length;
        checked = rule.checked;
      }
    }
    return checked;
  }

  /** Reads an explicit override first, then the inherited group state. */
  function isSelected(task: Task): boolean {
    if (!task.id) return false;
    return (
      tasks.get(task.id)?.checked ??
      groupDefault(/** Matches the task against a group path. */ (path) => inGroup(task, path))
    );
  }

  /** Records only differences from the inherited state. */
  function selectTasks(items: Task[], checked: boolean): void {
    for (const task of items) {
      if (!task.id) continue;
      if (checked === groupDefault(/** Matches the task against a group path. */ (path) => inGroup(task, path)))
        tasks.delete(task.id);
      else tasks.set(task.id, { task, checked });
    }
  }

  /** Replaces every override within a group with its new selection state. */
  function selectGroup(node: GroupNode<Task>, checked: boolean): void {
    for (const [key, rule] of groups) {
      if (isUnder(rule.node.path, node.path)) groups.delete(key);
    }
    for (const [id, rule] of tasks) {
      if (inGroup(rule.task, node.path)) tasks.delete(id);
    }
    if (checked !== groupDefault(/** Matches ancestor rules. */ (path) => isUnder(node.path, path))) {
      groups.set(node.key, { node, checked });
    }
  }

  /** Counts selected tasks using already loaded group totals and explicit overrides. */
  function countSelected(node?: GroupNode<Task>): number {
    let count =
      node && groupDefault(/** Finds the inherited state of this branch. */ (path) => isUnder(node.path, path))
        ? node.count
        : 0;
    for (const rule of groups.values()) {
      if (!node || (rule.node.path.length > node.path.length && isUnder(rule.node.path, node.path))) {
        count += rule.checked ? rule.node.count : -rule.node.count;
      }
    }
    for (const rule of tasks.values()) {
      if (!node || inGroup(rule.task, node.path)) count += rule.checked ? 1 : -1;
    }
    return count;
  }

  const selectedCount = computed(/** Counts selections across all groups and pages. */ () => countSelected());

  /** Returns the checkbox state for a whole group, including unloaded pages. */
  function groupState(node: GroupNode<Task>): boolean | 'indeterminate' {
    const count = countSelected(node);
    return count > 0 && (count >= node.count ? true : 'indeterminate');
  }

  /** Uses the legacy explicit-ID request when no whole group is selected. */
  function deletePayload(where: Record<string, unknown> | undefined) {
    if (selectedCount.value > bulkDeleteLimit) throw new Error(`Select at most ${bulkDeleteLimit} tasks per deletion.`);
    const includedGroups: GroupPath[] = [];
    const excludedGroups: GroupPath[] = [];
    const ids: string[] = [];
    const excludedIds: string[] = [];
    for (const rule of groups.values()) (rule.checked ? includedGroups : excludedGroups).push(rule.node.path);
    for (const [id, rule] of tasks) (rule.checked ? ids : excludedIds).push(id);
    return taskBulkDeleteSchema.parse(
      includedGroups.length
        ? {
            where,
            groups: includedGroups,
            excludedGroups,
            ids: ids.length ? ids : undefined,
            excludedIds: excludedIds.length ? excludedIds : undefined,
            expectedCount: selectedCount.value,
          }
        : { ids },
    );
  }

  /** Starts a fresh selection after a scope change or successful deletion. */
  function clearSelection(): void {
    groups.clear();
    tasks.clear();
  }

  return { selectedCount, isSelected, groupState, selectTasks, selectGroup, deletePayload, clearSelection };
}

/** Checks whether any group key is specific to a descendant branch of the given prefix. */
function isUnder(path: GroupPath, prefix: GroupPath): boolean {
  return prefix.every(
    /** Compares path values at the same depth. */ ({ field, value }, index) =>
      path[index]?.field === field && path[index]?.value === value,
  );
}

/** Compares a task's projected scalar fields to its group path. */
function inGroup(task: Task, path: GroupPath): boolean {
  return path.every(/** Matches each ancestor value. */ ({ field, value }) => task[field as keyof Task] === value);
}

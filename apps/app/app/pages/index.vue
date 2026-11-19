<template>
  <WorkItemsWorkItemTable v-if="session" :key="session.id" :session="session" />
</template>

<script setup lang="ts">
const { session } = useDemoSession();
</script>

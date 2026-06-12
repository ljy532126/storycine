<template>
  <div class="breadcrumb" v-if="$route.name !== 'WorkspaceView'">
    <router-link :to="home" class="bc-link">导演台</router-link>
    <span class="bc-sep"> &gt; </span>
    <template v-if="parent">
      <router-link :to="parent.to" class="bc-link">{{ parent.label }}</router-link>
      <span class="bc-sep"> &gt; </span>
    </template>
    <span class="bc-current">{{ title }}</span>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  home: { type: String, default: '/' },
  parent: Object,  // { to: '/script-generate', label: '剧本工坊' }
});
</script>

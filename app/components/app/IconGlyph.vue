<script setup>
defineProps({
  name: {
    type: String,
    required: true,
  },
  width: {
    type: [Number, String],
    default: 24,
  },
  height: {
    type: [Number, String],
    default: 24,
  },
})
</script>

<template>
  <svg
    v-if="name === 'home'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11h14V9" />
  </svg>

  <svg
    v-else-if="name === 'groups'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="9" cy="9" r="3.2" />
    <circle cx="17" cy="11" r="2.5" />
    <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
    <path d="M15 19c0-2 1.8-3.5 4-3.5" />
  </svg>

  <svg
    v-else-if="name === 'profile'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>

  <svg
    v-else-if="name === 'chat'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
  </svg>

  <svg
    v-else-if="name === 'scan'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" />
    <path d="M4 12h16" />
  </svg>

  <svg
    v-else-if="name === 'mic'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
    <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0" />
    <path d="M12 16v5" />
    <path d="M8.5 21h7" />
  </svg>

  <svg
    v-else-if="name === 'sparkle'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 2l1.8 5.6L19 9l-5.2 1.7L12 16l-1.8-5.3L5 9l5.2-1.4z" />
    <path d="M19 14l.9 2.5L22 17l-2.1.7L19 20l-.9-2.3L16 17l2.1-.5z" />
  </svg>

  <svg
    v-else-if="name === 'chevron'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>

  <svg
    v-else-if="name === 'plus'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>

  <svg
    v-else-if="name === 'bell'"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
</template>

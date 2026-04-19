<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: String,
    default: 'done',
  },
  toolName: {
    type: String,
    required: true,
  },
})

const toolLabels = {
  edit_extracted_receipt: 'Penny updates the receipt',
  extract_receipt: 'Penny reads the receipt',
  reconcile_extracted_receipt: 'Penny double-checks the math',
  search_previous_splits: 'Penny looks for past splits',
  submit_split_plan: 'Penny drafts the split',
}

const formattedToolName = computed(() => {
  const toolName = String(props.toolName || '').trim()

  return toolLabels[toolName]
    || toolName
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
})

const textClass = computed(() => {
  if (props.state === 'running') {
    return 'text-[var(--cream)]'
  }

  if (props.state === 'error') {
    return 'text-[rgba(255,168,154,0.96)]'
  }

  return 'text-[rgba(246,240,228,0.62)]'
})

const dotClass = computed(() => {
  if (props.state === 'running') {
    return 'bg-[rgba(246,181,51,0.92)] shadow-[0_0_0_4px_rgba(246,181,51,0.12)]'
  }

  if (props.state === 'error') {
    return 'bg-[rgba(255,84,54,0.88)]'
  }

  return 'bg-[rgba(246,240,228,0.22)]'
})
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="h-2.5 w-2.5 shrink-0 rounded-full"
      :class="dotClass"
    />

    <div class="min-w-0 text-sm leading-6" :class="textClass">
      {{ formattedToolName }}
    </div>
  </div>
</template>

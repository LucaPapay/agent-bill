<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'idle',
  },
  loadingChat: {
    type: Boolean,
    default: false,
  },
})

const phaseCopies = {
  loadingChat: [
    "Penny is oinking through your saved chat like a piglet looking for snacks.",
    "Penny is oinking open the archives and counting receipts by snout.",
    "Penny is oinking through the logs, one little hoofprint at a time.",
  ],
  starting: [
    'Penny is oinking up the pipeline and putting on her tiny accountant hat.',
    "Penny is oinking into her calculator and waking up the split brain.",
    'Penny is oinking its way to a clean start.',
  ],
  queued: [
    'Penny is oinking in line and politely bribing the nearest virtual piglet.',
    "Penny is oinking through the queue before it gets too grunty.",
    'Penny is oinking at the back of line and checking everyone got a receipt.',
  ],
  extracting: [
    'Penny is oinking through line items and sniffing out taxes and tips.',
    'Penny is oinking around with a magnifying glass and a calculator.',
    "Penny is oinking each item into tidy little piggy buckets.",
  ],
  agent: [
    'Penny is oinking through the split and balancing shares with ruthless fairness.',
    "Penny is oinking out who owes whom, then double-checking with her ledger horn.",
    "Penny is oinking at every item to stop drama before it squeals.",
  ],
  error: [
    'Penny is oinking at a glitch and asking for a clearer photo.',
    "Penny is oinking for backup snacks and a retry."
  ],
  idle: [
    'Penny is ready to help.',
  ],
}

const phraseList = computed(() => {
  if (props.loadingChat) {
    return phaseCopies.loadingChat
  }

  return phaseCopies[props.status] || phaseCopies.idle
})

const phraseIndex = ref(0)
let phraseTimer = null

function clearPhraseTimer() {
  if (!phraseTimer) {
    return
  }

  window.clearInterval(phraseTimer)
  phraseTimer = null
}

function cyclePhrase() {
  const total = phraseList.value.length

  if (total < 2) {
    return
  }

  phraseIndex.value = (phraseIndex.value + 1) % total
}

onMounted(() => {
  clearPhraseTimer()
  phraseTimer = window.setInterval(cyclePhrase, 1300)
})

onBeforeUnmount(() => {
  clearPhraseTimer()
})

watch(phraseList, () => {
  phraseIndex.value = 0
})

const loadingText = computed(() => phraseList.value[phraseIndex.value] || phraseList.value[0] || 'Penny is thinking.')
</script>

<template>
  <div class="flex items-center gap-2.5 px-1.5 py-1" role="status" aria-live="polite">
    <div
      class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[rgba(246,181,51,0.2)] border-t-[rgba(246,181,51,0.9)]"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1 text-sm leading-6 text-[rgba(246,240,228,0.82)]">
      {{ loadingText }}
    </div>

    <div class="flex items-center gap-1.5" aria-hidden="true">
      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(246,181,51,0.45)]" />
      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(246,181,51,0.45)] [animation-delay:150ms]" />
      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(246,181,51,0.45)] [animation-delay:300ms]" />
    </div>
  </div>
</template>

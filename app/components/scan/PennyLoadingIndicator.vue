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
  <div class="penny-loader-row" role="status" aria-live="polite">
    <div class="penny-loader-spinner" aria-hidden="true" />

    <div class="penny-loader-text">
      {{ loadingText }}
    </div>

    <div class="penny-loader-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped>
.penny-loader-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 4px 2px 4px 6px;
}

.penny-loader-spinner {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  flex-shrink: 0;
  border: 2px solid rgba(246, 181, 51, 0.2);
  border-top-color: rgba(246, 181, 51, 0.9);
  animation: penny-loader-spin 0.8s linear infinite;
}

.penny-loader-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(246, 240, 228, 0.82);
}

.penny-loader-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}

.penny-loader-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(246, 181, 51, 0.45);
  animation: penny-loader-pulse 0.9s ease-in-out infinite;
}

.penny-loader-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.penny-loader-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes penny-loader-pulse {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  50% {
    transform: translateY(-2px);
    opacity: 1;
  }
}

@keyframes penny-loader-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

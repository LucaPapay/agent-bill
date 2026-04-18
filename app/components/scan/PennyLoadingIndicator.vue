<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'

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
  <div class="penny-loader-row">
    <div class="penny-loader-avatar">
      <IconGlyph name="sparkle" width="16" height="16" />
    </div>
    <div class="penny-loader-bubble">
      {{ loadingText }}
      <span class="penny-loader-anim" aria-hidden="true">...</span>
    </div>
  </div>
</template>

<style scoped>
.penny-loader-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.penny-loader-avatar {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 181, 51, 0.16);
  color: var(--marigold);
}

.penny-loader-bubble {
  max-width: min(100%, 680px);
  border-radius: 22px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  display: inline-flex;
  gap: 6px;
  align-items: center;
  animation: penny-loader-wiggle 1.4s ease-in-out infinite;
}

.penny-loader-anim {
  display: inline-block;
  width: 20px;
}

@keyframes penny-loader-wiggle {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(2px);
  }
}
</style>

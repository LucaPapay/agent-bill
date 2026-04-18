<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { sampleBill } from '../app/mockData'

const emit = defineEmits(['done'])

const phase = ref('aim')
const revealed = ref(0)

let revealTimer = null
let doneTimer = null

const ocrLines = computed(() => [
  ...sampleBill.items.map(item => ({
    left: item.name,
    right: `$${item.price.toFixed(2)}`,
  })),
  { left: 'SUBTOTAL', right: `$${sampleBill.subtotal.toFixed(2)}`, bold: true },
  { left: 'TAX', right: `$${sampleBill.tax.toFixed(2)}` },
  { left: 'TIP', right: `$${sampleBill.tip.toFixed(2)}` },
])

function clearTimers() {
  window.clearInterval(revealTimer)
  window.clearTimeout(doneTimer)
}

function startScan() {
  if (phase.value !== 'aim') {
    return
  }

  phase.value = 'scanning'
}

watch(phase, value => {
  clearTimers()

  if (value === 'scanning') {
    revealed.value = 0
    revealTimer = window.setInterval(() => {
      if (revealed.value >= sampleBill.items.length + 3) {
        window.clearInterval(revealTimer)
        doneTimer = window.setTimeout(() => {
          phase.value = 'done'
        }, 500)
        return
      }

      revealed.value += 1
    }, 260)
  }

  if (value === 'done') {
    doneTimer = window.setTimeout(() => {
      emit('done')
    }, 900)
  }
})

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <div class="screen screen-dark">
    <div
      style="position: relative; flex: 1; margin: 8px 18px 0; border-radius: 28px; overflow: hidden; background: #1a1814; min-height: 560px; display: flex; flex-direction: column;"
    >
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px;">
        <div
          :style="{
            background: phase === 'aim' ? '#e8e0ce' : '#fbf7ee',
            width: '78%',
            padding: '24px 18px',
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: '#2a2621',
            transform: phase === 'aim' ? 'rotate(-3deg) scale(0.92)' : 'rotate(-1deg) scale(1)',
            transition: 'all 0.5s cubic-bezier(.2,.8,.2,1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            filter: phase === 'aim' ? 'blur(1.2px) brightness(0.9)' : 'none',
            position: 'relative',
          }"
        >
          <div style="text-align: center; font-weight: 700; font-size: 14px; margin-bottom: 2px;">
            TUCA'S TAPAS
          </div>
          <div style="text-align: center; font-size: 9px; opacity: 0.6; margin-bottom: 12px;">
            188 E 3RD ST · APR 17
          </div>

          <div
            v-for="(line, index) in ocrLines"
            :key="`${line.left}-${index}`"
            :class="{ 'ghost-in': phase === 'scanning' && index === revealed - 1 }"
            :style="{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '8px',
              fontWeight: line.bold ? 700 : 500,
              borderTop: line.bold ? '1px dashed #2a2621' : 'none',
              paddingTop: line.bold ? '6px' : '1px',
              marginTop: line.bold ? '6px' : 0,
              opacity: phase !== 'scanning' || index < revealed ? 1 : 0.25,
              transition: 'opacity 0.3s',
            }"
          >
            <span>{{ line.left }}</span>
            <span>{{ line.right }}</span>
          </div>
        </div>
      </div>

      <template v-if="phase === 'aim'">
        <div
          v-for="corner in [
            { key: 'tl', top: '16px', left: '16px', rot: '0deg' },
            { key: 'tr', top: '16px', right: '16px', rot: '90deg' },
            { key: 'br', bottom: '16px', right: '16px', rot: '180deg' },
            { key: 'bl', bottom: '16px', left: '16px', rot: '270deg' },
          ]"
          :key="corner.key"
          :style="{ position: 'absolute', width: '32px', height: '32px', transform: `rotate(${corner.rot})`, ...corner }"
        >
          <div style="position: absolute; top: 0; left: 0; width: 18px; height: 2px; background: var(--tomato);" />
          <div style="position: absolute; top: 0; left: 0; width: 2px; height: 18px; background: var(--tomato);" />
        </div>
      </template>

      <div v-if="phase === 'scanning'" class="scan-line" />

      <div v-if="phase === 'scanning' && revealed > 2" style="position: absolute; top: 90px; left: 28px; pointer-events: none;">
        <div style="background: var(--tomato); color: var(--cream); padding: 4px 8px; font-family: var(--mono); font-size: 9px; font-weight: 700; border-radius: 4px; letter-spacing: 0.08em;">
          ITEM · $16.50
        </div>
      </div>

      <div v-if="phase === 'scanning' && revealed > 5" style="position: absolute; top: 180px; right: 28px; pointer-events: none;">
        <div style="background: var(--marigold); color: var(--ink); padding: 4px 8px; font-family: var(--mono); font-size: 9px; font-weight: 700; border-radius: 4px; letter-spacing: 0.08em;">
          QTY × 2 detected
        </div>
      </div>

      <div style="position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(20,18,16,0.8); color: var(--cream); padding: 8px 14px; border-radius: 100px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(10px);">
        <div
          :class="{ blink: phase === 'scanning' }"
          :style="{
            width: '8px',
            height: '8px',
            borderRadius: '4px',
            background: phase === 'done' ? 'var(--mint)' : 'var(--tomato)',
          }"
        />

        <span v-if="phase === 'aim'">ALIGN RECEIPT IN FRAME</span>
        <span v-else-if="phase === 'scanning'">PENNY READING · {{ revealed }}/{{ ocrLines.length }}</span>
        <span v-else>DONE · 8 ITEMS</span>
      </div>
    </div>

    <div style="padding: 20px 18px 0; display: flex; gap: 10px; align-items: center; justify-content: center;">
      <button style="width: 52px; height: 52px; border-radius: 16px; background: rgba(255,255,255,0.08); color: var(--cream); display: flex; align-items: center; justify-content: center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>

      <button
        :disabled="phase !== 'aim'"
        :style="{
          width: '72px',
          height: '72px',
          borderRadius: '36px',
          background: phase === 'aim' ? 'var(--cream)' : 'rgba(255,255,255,0.25)',
          border: '4px solid rgba(255,255,255,0.4)',
        }"
        @click="startScan"
      >
        <svg
          v-if="phase === 'done'"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="margin: auto;"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>

      <button style="width: 52px; height: 52px; border-radius: 16px; background: rgba(255,255,255,0.08); color: var(--cream); display: flex; align-items: center; justify-content: center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      </button>
    </div>

    <div class="scan-helper">
      {{ phase === 'aim' ? 'TAP TO SCAN · OR USE CAMERA ROLL' : 'PENNY IS WORKING...' }}
    </div>
  </div>
</template>

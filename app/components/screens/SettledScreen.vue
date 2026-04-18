<script setup>
import { avatarColors } from '../app/mockData'

const emit = defineEmits(['nav'])

const rows = [
  ['You', 46.1, 'paid'],
  ['Sarah', 38.2, 'requested'],
  ['Miles', 52.8, 'requested'],
  ['Priya', 47.3, 'requested'],
]
</script>

<template>
  <div class="screen" style="align-items: center; justify-content: center; padding-top: 32px;">
    <div class="section-pad" style="width: 100%;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span class="tape" style="background: var(--mint);">
          Splits sent
        </span>
      </div>

      <div class="receipt perforated-top perforated-bottom" style="padding: 28px 22px; margin: 0 6px; font-family: var(--mono);">
        <div style="text-align: center;">
          <div style="font-size: 10px; letter-spacing: 0.12em; color: var(--muted);">
            AGENT-BILL · #04217
          </div>
          <div class="h-display" style="font-size: 28px; margin: 8px 0 2px;">
            Tuca's Tapas
          </div>
          <div style="font-size: 10px; letter-spacing: 0.08em; color: var(--muted);">
            APR 17 · 4 PEOPLE · 8 ITEMS
          </div>
        </div>

        <div style="border-top: 1.5px dashed var(--ink); margin: 16px 0;" />

        <div
          v-for="row in rows"
          :key="row[0]"
          style="display: flex; align-items: center; gap: 10px; padding: 8px 0;"
        >
          <div
            :style="{
              width: '28px',
              height: '28px',
              borderRadius: '14px',
              background: avatarColors[row[0]],
              border: '1.5px solid var(--ink)',
              color: 'var(--ink)',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
          >
            {{ row[0].charAt(0) }}
          </div>
          <div style="flex: 1; font-size: 13px; font-family: var(--ui); font-weight: 600;">
            {{ row[0] }}
          </div>
          <div
            :style="{
              fontSize: '10px',
              fontWeight: 700,
              color: row[2] === 'paid' ? 'var(--mint)' : 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }"
          >
            {{ row[2] }}
          </div>
          <div class="mono" style="width: 64px; text-align: right; font-weight: 700; font-size: 13px;">
            ${{ row[1].toFixed(2) }}
          </div>
        </div>

        <div style="border-top: 1.5px dashed var(--ink); margin: 12px 0 4px;" />
        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 14px;">
          <span>TOTAL</span>
          <span>$184.40</span>
        </div>

        <div style="margin-top: 18px; text-align: center; font-size: 9px; letter-spacing: 0.15em; color: var(--muted);">
          ★ ★ ★ &nbsp; THANK YOU &nbsp; ★ ★ ★
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button class="btn btn-ghost" style="flex: 1;" @click="emit('nav', 'home')">
          Done
        </button>
        <button class="btn btn-primary" style="flex: 1;">
          Share recap
        </button>
      </div>
    </div>
  </div>
</template>

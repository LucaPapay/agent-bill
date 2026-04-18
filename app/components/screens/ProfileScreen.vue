<script setup>
import AvatarBadge from '../app/AvatarBadge.vue'
import IconGlyph from '../app/IconGlyph.vue'

const settings = [
  ['Notifications', '3 active'],
  ['Auto-detect receipts', 'On · camera roll'],
  ['Default split', 'Equal'],
  ['Currency', 'USD'],
  ['Export history', ''],
]
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 20px;">
      <h1 class="h-display" style="font-size: 42px; line-height: 1; margin: 0;">
        You
      </h1>
    </div>

    <div class="section-pad profile-grid">
      <div class="surface-panel" style="padding: 20px; display: flex; gap: 14px; align-items: center;">
        <AvatarBadge name="You" size="lg" />
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 18px;">
            Jojo Pirker
          </div>
          <div style="font-size: 12px; color: var(--muted);">
            j.pirker@gmail.com · local-first mode
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <span class="chip chip-muted">Personal workspace</span>
            <span class="chip chip-muted">No auth yet</span>
          </div>
        </div>
        <IconGlyph name="chevron" width="18" height="18" />
      </div>

      <div>
        <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
          Your assistant
        </div>

        <div style="background: var(--ink); color: var(--cream); border-radius: 22px; padding: 18px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 14px; background: var(--marigold); color: var(--ink); display: flex; align-items: center; justify-content: center;">
              <IconGlyph name="sparkle" width="24" height="24" />
            </div>

            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 16px;">
                Penny
              </div>
              <div style="font-size: 12px; opacity: 0.7;">
                Split assistant · casual tone
              </div>
            </div>

            <div class="chip" style="background: var(--mint); color: var(--ink);">
              on
            </div>
          </div>

          <div style="font-size: 13px; margin-top: 14px; opacity: 0.85; line-height: 1.4;">
            Penny scans receipts, suggests splits, and handles the awkward bits so the interface can stay simple.
          </div>
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 16px;">
      <div class="surface-panel" style="overflow: hidden;">
        <div
          v-for="([label, detail], index) in settings"
          :key="label"
          :style="{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: index < settings.length - 1 ? '1px solid rgba(20,18,16,0.08)' : 'none',
          }"
        >
          <div style="flex: 1; font-size: 15px; font-weight: 500;">
            {{ label }}
          </div>
          <span v-if="detail" class="mono" style="font-size: 12px; color: var(--muted); margin-right: 8px;">
            {{ detail }}
          </span>
          <IconGlyph name="chevron" width="16" height="16" style="color: var(--muted);" />
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-top: 22px; text-align: center;">
      <div class="mono" style="font-size: 10px; color: var(--muted); letter-spacing: 0.15em;">
        AGENT-BILL · FRONTEND MOCK
      </div>
    </div>
  </div>
</template>

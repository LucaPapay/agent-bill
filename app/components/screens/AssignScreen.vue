<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { avatarColors, initialAssignments, people, sampleBill } from '../app/mockData'
import IconGlyph from '../app/IconGlyph.vue'

const props = defineProps({
  layout: {
    type: String,
    default: 'cards',
  },
})

const emit = defineEmits(['done', 'update:layout'])

const layoutOptions = [
  { id: 'cards', label: 'Cards' },
  { id: 'spreadsheet', label: 'Sheet' },
  { id: 'chat', label: 'Walkthrough' },
]

const assignments = ref(
  Object.fromEntries(
    Object.entries(initialAssignments).map(([key, value]) => [key, [...value]]),
  ),
)
const dragItem = ref('')
const dragPos = ref({ x: 0, y: 0 })
const hoverPerson = ref('')

const totals = computed(() => {
  const result = Object.fromEntries(people.map(person => [person, 0]))

  sampleBill.items.forEach(item => {
    const members = assignments.value[item.id] || []

    if (!members.length) {
      return
    }

    const share = item.price / members.length

    members.forEach(person => {
      result[person] += share
    })
  })

  const extras = sampleBill.tax + sampleBill.tip
  people.forEach(person => {
    const fraction = sampleBill.subtotal > 0 ? result[person] / sampleBill.subtotal : 0
    result[person] += fraction * extras
  })

  return result
})

const draggingItem = computed(() => sampleBill.items.find(item => item.id === dragItem.value))

function onPointerDown(itemId, event) {
  event.preventDefault()
  dragItem.value = itemId
  dragPos.value = { x: event.clientX, y: event.clientY }
}

function onPointerMove(event) {
  if (!dragItem.value) {
    return
  }

  dragPos.value = { x: event.clientX, y: event.clientY }
  const element = document.elementFromPoint(event.clientX, event.clientY)
  const target = element && element.closest('[data-person]')
  hoverPerson.value = target ? target.dataset.person || '' : ''
}

function onPointerUp() {
  if (!dragItem.value) {
    return
  }

  if (hoverPerson.value) {
    const current = assignments.value[dragItem.value] || []
    assignments.value = {
      ...assignments.value,
      [dragItem.value]: current.includes(hoverPerson.value)
        ? current.filter(person => person !== hoverPerson.value)
        : [...current, hoverPerson.value],
    }
  }

  dragItem.value = ''
  hoverPerson.value = ''
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div class="screen">
    <div class="section-pad" style="padding-top: 24px; padding-bottom: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
      <div>
        <span class="tape">Receipt · Apr 17</span>
        <h1 class="h-display" style="font-size: 36px; line-height: 1; margin: 8px 0 0;">
          {{ sampleBill.merchant }}
        </h1>
        <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          ${{ sampleBill.total.toFixed(2) }} · {{ sampleBill.items.length }} ITEMS · {{ people.length }} PEOPLE
        </div>
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
        <button
          v-for="option in layoutOptions"
          :key="option.id"
          class="chip"
          :style="{
            background: layout === option.id ? 'var(--ink)' : 'rgba(20,18,16,0.08)',
            color: layout === option.id ? 'var(--cream)' : 'var(--ink)',
          }"
          @click="emit('update:layout', option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="section-pad assign-layout">
      <div class="assign-sidebar">
        <div class="surface-panel" style="padding: 12px;">
          <div style="display: flex; gap: 8px; justify-content: space-between;">
            <div
              v-for="person in people"
              :key="person"
              :data-person="person"
              class="drop-target"
              :class="{ over: hoverPerson === person }"
              :style="{
                flex: 1,
                background: hoverPerson === person ? 'var(--ink)' : 'var(--paper)',
                color: hoverPerson === person ? 'var(--cream)' : 'var(--ink)',
                borderRadius: '16px',
                padding: '10px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.15s',
                border: hoverPerson === person ? '2px solid var(--tomato)' : '1px solid rgba(20,18,16,0.1)',
              }"
            >
              <div
                :style="{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  background: avatarColors[person],
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  border: '2px solid var(--ink)',
                  fontSize: '16px',
                }"
              >
                {{ person.charAt(0) }}
              </div>
              <div style="font-size: 11px; font-weight: 600;">
                {{ person }}
              </div>
              <div class="mono" style="font-size: 12px; font-weight: 700;">
                ${{ totals[person].toFixed(2) }}
              </div>
            </div>
          </div>
        </div>

        <div style="background: var(--marigold); color: var(--ink); border-radius: 14px; padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; border: 1.5px solid var(--ink);">
          <IconGlyph name="sparkle" width="16" height="16" style="flex-shrink: 0; margin-top: 2px;" />
          <div style="font-size: 12px; line-height: 1.35;">
            <b>Penny:</b> I split the sangria and shared tapas evenly, then matched drinks to likely orders. Drag any item to override.
          </div>
        </div>

        <div style="background: var(--ink); color: var(--cream); border-radius: 22px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">
              You owe
            </span>
            <span class="h-display" style="font-size: 40px;">
              ${{ totals.You.toFixed(2) }}
            </span>
          </div>
          <div class="mono" style="font-size: 11px; opacity: 0.5; margin-bottom: 12px;">
            Incl. tax + 20% tip, distributed by share
          </div>
          <button class="btn btn-accent btn-block" @click="emit('done')">
            Send splits to everyone
            <IconGlyph name="chevron" width="16" height="16" />
          </button>
        </div>
      </div>

      <div class="assign-items-card">
        <div v-if="layout === 'cards'" style="display: flex; flex-direction: column; gap: 8px;">
          <div
            v-for="item in sampleBill.items"
            :key="item.id"
            class="draggable surface-panel"
            :class="{ dragging: dragItem === item.id }"
            style="padding: 12px 14px; display: flex; align-items: center; gap: 12px;"
            @pointerdown="onPointerDown(item.id, $event)"
          >
            <svg width="14" height="18" viewBox="0 0 14 18" style="color: var(--muted); flex-shrink: 0;">
              <circle cx="3" cy="4" r="1.3" fill="currentColor" />
              <circle cx="11" cy="4" r="1.3" fill="currentColor" />
              <circle cx="3" cy="9" r="1.3" fill="currentColor" />
              <circle cx="11" cy="9" r="1.3" fill="currentColor" />
              <circle cx="3" cy="14" r="1.3" fill="currentColor" />
              <circle cx="11" cy="14" r="1.3" fill="currentColor" />
            </svg>

            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 14px;">
                {{ item.name }}
              </div>
              <div style="display: flex; margin-top: 4px; gap: 2px;">
                <span v-if="!(assignments[item.id] || []).length" style="font-size: 11px; color: var(--tomato); font-weight: 600;">
                  unassigned
                </span>
                <div
                  v-for="(person, index) in assignments[item.id] || []"
                  :key="`${item.id}-${person}`"
                  :style="{ marginLeft: index === 0 ? 0 : '-6px' }"
                >
                  <div
                    :style="{
                      width: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      background: avatarColors[person],
                      border: '1.5px solid var(--paper)',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }"
                  >
                    {{ person.charAt(0) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="mono" style="font-weight: 700; font-size: 14px;">
              ${{ item.price.toFixed(2) }}
            </div>
          </div>
        </div>

        <div
          v-else-if="layout === 'spreadsheet'"
          class="surface-panel"
          style="overflow: hidden;"
        >
          <div style="display: grid; grid-template-columns: 1.5fr repeat(4, 1fr) 0.8fr; font-family: var(--mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: var(--ink); color: var(--cream); padding: 6px 0;">
            <div style="padding-left: 10px;">
              Item
            </div>
            <div v-for="person in people" :key="`head-${person}`" style="text-align: center;">
              {{ person.charAt(0) }}
            </div>
            <div style="text-align: right; padding-right: 10px;">
              $
            </div>
          </div>

          <div
            v-for="(item, index) in sampleBill.items"
            :key="item.id"
            class="draggable"
            :style="{
              display: 'grid',
              gridTemplateColumns: '1.5fr repeat(4, 1fr) 0.8fr',
              alignItems: 'center',
              padding: '10px 0',
              borderTop: index === 0 ? 'none' : '1px solid rgba(20,18,16,0.08)',
              fontSize: '12px',
              opacity: dragItem === item.id ? 0.5 : 1,
            }"
            @pointerdown="onPointerDown(item.id, $event)"
          >
            <div style="padding-left: 10px; font-weight: 600;">
              {{ item.name }}
            </div>

            <div v-for="person in people" :key="`${item.id}-${person}`" style="text-align: center;">
              <div
                :style="{
                  width: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  margin: '0 auto',
                  background: (assignments[item.id] || []).includes(person) ? avatarColors[person] : 'transparent',
                  border: (assignments[item.id] || []).includes(person) ? '1.5px solid var(--ink)' : '1.5px dashed rgba(20,18,16,0.2)',
                }"
              />
            </div>

            <div class="mono" style="text-align: right; padding-right: 10px; font-weight: 700;">
              {{ item.price.toFixed(2) }}
            </div>
          </div>
        </div>

        <div v-else style="display: flex; flex-direction: column; gap: 10px;">
          <div class="agent-bubble" style="max-width: 90%;">
            Walking through each item. Confirm or drag to reassign.
          </div>

          <template v-for="item in sampleBill.items" :key="item.id">
            <div
              class="draggable"
              :style="{
                alignSelf: 'flex-end',
                background: 'var(--paper)',
                border: '1.5px solid var(--ink)',
                borderRadius: '18px 18px 4px 18px',
                padding: '10px 14px',
                maxWidth: '85%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: dragItem === item.id ? 0.5 : 1,
              }"
              @pointerdown="onPointerDown(item.id, $event)"
            >
              <span style="font-weight: 600; font-size: 13px;">
                {{ item.name }}
              </span>
              <span class="mono" style="font-size: 12px; font-weight: 700;">
                ${{ item.price.toFixed(2) }}
              </span>
            </div>

            <div class="agent-bubble" style="font-size: 12px;">
              Goes to <b>{{ (assignments[item.id] || []).length === 4 ? 'everyone' : (assignments[item.id] || []).join(' & ') || 'nobody' }}</b>
              <div style="display: flex; margin-top: 6px; gap: 2px;">
                <div
                  v-for="(person, index) in assignments[item.id] || []"
                  :key="`${item.id}-${person}-bubble`"
                  :style="{ marginLeft: index === 0 ? 0 : '-6px' }"
                >
                  <div
                    :style="{
                      width: '22px',
                      height: '22px',
                      borderRadius: '11px',
                      background: avatarColors[person],
                      border: '1.5px solid var(--ink)',
                      color: 'var(--ink)',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }"
                  >
                    {{ person.charAt(0) }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="draggingItem"
      :style="{
        position: 'fixed',
        left: `${dragPos.x - 90}px`,
        top: `${dragPos.y - 20}px`,
        background: 'var(--tomato)',
        color: 'var(--cream)',
        padding: '8px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
        pointerEvents: 'none',
        zIndex: 999,
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        transform: 'rotate(-3deg)',
      }"
    >
      {{ draggingItem.name }} · ${{ draggingItem.price.toFixed(2) }}
    </div>
  </div>
</template>

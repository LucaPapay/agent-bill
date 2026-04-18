<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'

const emit = defineEmits(['done', 'jump-to-items'])

const demoAvatarColors = {
  You: '#F6B533',
  Sarah: '#FF5436',
  Miles: '#8FC56A',
  Priya: '#B9A6E8',
}

const demoPeople = ['You', 'Sarah', 'Miles', 'Priya']

const initialMessages = [
  {
    who: 'penny',
    text: "Scan done — 8 items, $184.40 at Tuca's Tapas. Who was there?",
    chips: ['Everyone (4)', 'Me + Sarah', 'Pick...'],
  },
]

const flow = [
  {
    userText: 'Everyone (4)',
    reply: {
      who: 'penny',
      text: 'Got it — 4 people. How should I split it?',
      chips: ['Even split', 'By items', "I paid for Sarah's drink"],
      avatars: demoPeople,
    },
  },
  {
    userText: 'By items',
    reply: {
      who: 'penny',
      text: 'Okay. Pre-splitting by who ordered what. Quick sanity check: the sangria pitcher was for everyone, right?',
      chips: ['Yep, 4-way', 'Just me + Miles', 'Skip Priya (driving)'],
    },
  },
  {
    userText: 'Yep, 4-way',
    reply: {
      who: 'penny',
      text: 'Noted. One edge case — Priya added a flan at the end. On her alone?',
      chips: ['Yes, on Priya', 'Split 2-way with me', 'Everyone had a bite'],
    },
  },
  {
    userText: 'Yes, on Priya',
    reply: {
      who: 'penny',
      text: "Alright. Also — you covered Sarah's tempranillo last time. Want me to balance that here?",
      chips: ['Yes, even us up', 'No, keep clean', 'Remind me later'],
    },
  },
  {
    userText: 'Yes, even us up',
    reply: {
      who: 'penny',
      text: "Here's the split:",
      summary: [
        { name: 'You', amount: 42.1 },
        { name: 'Sarah', amount: 36.5 },
        { name: 'Miles', amount: 54.9 },
        { name: 'Priya', amount: 50.9 },
      ],
    },
  },
]

const messages = ref([...initialMessages])
const input = ref('')
const recording = ref(false)
const done = ref(false)
const step = ref(0)
const scrollRef = ref(null)

let voiceTimer = null

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}

function pushUser(text) {
  messages.value.push({ who: 'user', text })
}

function advance(text) {
  const current = flow[step.value]

  if (!current) {
    return
  }

  pushUser(text || current.userText)
  step.value += 1

  window.setTimeout(() => {
    messages.value.push(current.reply)
    if (current.reply.summary) {
      done.value = true
    }
  }, 650)
}

function onChip(chip) {
  advance(chip)
}

function onSend() {
  if (!input.value.trim()) {
    return
  }

  advance(input.value.trim())
  input.value = ''
}

function toggleVoice() {
  if (recording.value) {
    return
  }

  const current = flow[step.value]

  if (!current) {
    return
  }

  const transcript = current.userText
  let tick = 0

  recording.value = true
  voiceTimer = window.setInterval(() => {
    tick += 1
    input.value = transcript.slice(0, Math.round(transcript.length * (tick / 8)))

    if (tick >= 8) {
      window.clearInterval(voiceTimer)
      recording.value = false
      window.setTimeout(() => {
        advance(transcript)
        input.value = ''
      }, 200)
    }
  }, 180)
}

watch(messages, scrollToBottom, { deep: true })

onBeforeUnmount(() => {
  window.clearInterval(voiceTimer)
})
</script>

<template>
  <div class="screen" style="padding-bottom: 0; display: flex; flex-direction: column;">
    <div class="section-pad" style="padding-top: 8px; padding-bottom: 16px; display: flex; align-items: flex-start; justify-content: space-between; flex-shrink: 0;">
      <div>
        <span class="tape">Just scanned</span>
        <h1 class="h-display" style="font-size: 28px; line-height: 1.15; margin: 8px 0 0;">
          Split this bill
        </h1>
        <div class="mono" style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          TUCA'S TAPAS · $184.40 · 8 ITEMS
        </div>
      </div>
    </div>

    <div class="section-pad" style="margin-bottom: 8px; flex-shrink: 0;">
      <button
        style="background: var(--paper); border-radius: 14px; padding: 10px 12px; display: flex; gap: 10px; align-items: center; width: 100%; border: 1px dashed rgba(20,18,16,0.25);"
        @click="emit('jump-to-items')"
      >
        <div style="font-size: 22px;">
          🧾
        </div>
        <div style="flex: 1; text-align: left;">
          <div style="font-size: 12px; font-weight: 700;">
            View itemized receipt
          </div>
          <div class="mono" style="font-size: 10px; color: var(--muted);">
            8 items · drag to reassign
          </div>
        </div>
        <IconGlyph name="chevron" width="16" height="16" />
      </button>
    </div>

    <div ref="scrollRef" class="chat-stream">
      <template v-for="(message, index) in messages" :key="`${message.text}-${index}`">
        <div
          v-if="message.who === 'user'"
          class="agent-bubble user"
          style="max-width: 80%; font-size: 14px; font-weight: 500; padding: 10px 14px;"
        >
          {{ message.text }}
        </div>

        <div v-else style="display: flex; flex-direction: column; gap: 8px; max-width: 88%;">
          <div style="display: flex; gap: 8px; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 10px; background: var(--ink); color: var(--marigold); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
              <IconGlyph name="sparkle" width="16" height="16" />
            </div>

            <div style="background: var(--ink); color: var(--cream); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.4;">
              {{ message.text }}
            </div>
          </div>

          <div v-if="message.avatars" style="display: flex; gap: 6px; padding-left: 36px; flex-wrap: wrap;">
            <div
              v-for="person in message.avatars"
              :key="person"
              style="display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; background: var(--paper); border-radius: 100px; border: 1px solid rgba(20,18,16,0.1); font-size: 12px; font-weight: 600;"
            >
              <div
                :style="{
                  width: '22px',
                  height: '22px',
                  borderRadius: '11px',
                  background: demoAvatarColors[person],
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid var(--ink)',
                }"
              >
                {{ person.charAt(0) }}
              </div>
              {{ person }}
            </div>
          </div>

          <div v-if="message.chips" style="display: flex; gap: 6px; padding-left: 36px; flex-wrap: wrap;">
            <button
              v-for="chip in message.chips"
              :key="chip"
              style="padding: 7px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; background: var(--paper); border: 1.5px solid var(--ink); color: var(--ink);"
              @click="onChip(chip)"
            >
              {{ chip }}
            </button>
          </div>

          <div
            v-if="message.summary"
            style="margin-left: 36px; background: var(--paper); border-radius: 16px; padding: 12px 14px; border: 1.5px solid var(--ink);"
          >
            <div
              v-for="row in message.summary"
              :key="row.name"
              style="display: flex; align-items: center; gap: 10px; padding: 6px 0;"
            >
              <div
                :style="{
                  width: '26px',
                  height: '26px',
                  borderRadius: '13px',
                  background: demoAvatarColors[row.name],
                  border: '1.5px solid var(--ink)',
                  color: 'var(--ink)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }"
              >
                {{ row.name.charAt(0) }}
              </div>
              <div style="flex: 1; font-size: 13px; font-weight: 600;">
                {{ row.name }}
              </div>
              <div class="mono" style="font-weight: 700; font-size: 14px;">
                ${{ row.amount.toFixed(2) }}
              </div>
            </div>

            <button class="btn btn-accent btn-block" style="margin-top: 10px;" @click="emit('done')">
              Send splits
            </button>
          </div>
        </div>
      </template>

      <div v-if="recording" class="mono" style="font-size: 10px; color: var(--tomato); text-align: center; padding: 4px;">
        ● LISTENING...
      </div>
    </div>

    <div style="padding: 10px 16px 84px; background: linear-gradient(to bottom, transparent, var(--cream) 30%); flex-shrink: 0;">
      <div style="background: var(--paper); border-radius: 24px; padding: 6px; display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--ink); box-shadow: 0 6px 16px rgba(0,0,0,0.06);">
        <input
          v-model="input"
          type="text"
          :placeholder="done ? 'Anything else, Jojo?' : 'Tell Penny how to split...'"
          style="flex: 1; border: none; background: transparent; outline: none; padding: 10px 12px; font-size: 14px; font-family: var(--ui); color: var(--ink); min-width: 0;"
          @keydown.enter="onSend"
        >

        <button
          :style="{
            width: '40px',
            height: '40px',
            borderRadius: '20px',
            background: recording ? 'var(--tomato)' : 'transparent',
            color: recording ? 'var(--cream)' : 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: recording ? 'none' : '1.5px solid var(--ink)',
            position: 'relative',
            flexShrink: 0,
          }"
          aria-label="Voice input"
          @click="toggleVoice"
        >
          <span v-if="recording" class="voice-pulse" />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>

        <button
          style="width: 40px; height: 40px; border-radius: 20px; background: var(--ink); color: var(--cream); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
          aria-label="Send"
          @click="onSend"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div class="mono" style="font-size: 9px; letter-spacing: 0.12em; color: var(--muted); text-align: center; margin-top: 6px; text-transform: uppercase;">
        Try: "I covered Sarah's drink" or hold 🎙 to talk
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useOrpc()

const title = ref('Friday dinner at Oida')
const peopleText = ref('Jojo, Alex, Sam')
const rawText = ref(`Burger 14.50
Fries 5.20
Spritz 8.50
Tiramisu 7.80
Tax 3.00
Tip 4.00
Total 43.00`)
const health = ref<any>(null)
const result = ref<any>(null)
const loading = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const exampleIdeas = [
  'Paste OCR text if you do not want to use AI yet.',
  'Upload a receipt image when OPENAI_API_KEY is set.',
  'The current fallback strategy is intentionally boring: parse text, then split evenly.',
]

onMounted(() => {
  api.health().then((value) => {
    health.value = value
  })
})

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format((cents || 0) / 100)
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] || '' : value)
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

async function runAnalysis() {
  loading.value = true
  errorMessage.value = ''

  const file = fileInput.value?.files?.[0]
  const people = peopleText.value
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  const payload = {
    title: title.value,
    people,
    rawText: rawText.value.trim() || undefined,
    imageBase64: file ? await fileToBase64(file) : undefined,
    mimeType: file?.type || undefined,
  }

  await api.analyzeBill(payload).then(
    (value: any) => {
      result.value = value
    },
    (error: any) => {
      errorMessage.value = error?.message || 'The bill analysis request failed.'
    },
  )

  loading.value = false
}
</script>

<template>
  <main class="min-h-screen px-5 py-8 text-ink sm:px-8 lg:px-10">
    <div class="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="rounded-[2rem] border border-white/60 bg-paper/85 p-6 card-shadow backdrop-blur sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-2xl">
            <p class="mb-3 inline-flex rounded-full border border-accent/25 bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.22em] text-accent-deep uppercase">
              Agentic bill splitting
            </p>
            <h1 class="max-w-xl font-serif text-4xl leading-tight sm:text-5xl">
              Scan a receipt, let an agent pull it apart, and start from a sane split.
            </h1>
            <p class="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              This first setup keeps the frontend as a Nuxt SPA, keeps the backend in Nitro,
              persists every analysis run in local Postgres, and uses Pi when an API key is present.
            </p>
          </div>

          <div class="receipt-grid rounded-[1.75rem] border border-accent/15 bg-paper-strong/80 p-4 text-sm card-shadow">
            <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Local stack</p>
            <div class="mt-3 grid gap-2 text-sm">
              <div class="flex items-center justify-between gap-6">
                <span>Nuxt SPA</span>
                <span class="rounded-full bg-white px-2 py-1 text-xs">client-only</span>
              </div>
              <div class="flex items-center justify-between gap-6">
                <span>oRPC</span>
                <span class="rounded-full bg-white px-2 py-1 text-xs">/rpc</span>
              </div>
              <div class="flex items-center justify-between gap-6">
                <span>Postgres</span>
                <span class="rounded-full bg-white px-2 py-1 text-xs">docker</span>
              </div>
              <div class="flex items-center justify-between gap-6">
                <span>Pi</span>
                <span class="rounded-full bg-white px-2 py-1 text-xs">
                  {{ health?.piReady ? 'ready' : 'needs key' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <form class="grid gap-4" @submit.prevent="runAnalysis">
            <label class="grid gap-2">
              <span class="text-sm font-medium">Bill title</span>
              <input
                v-model="title"
                class="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-accent/60"
                placeholder="Late night schnitzel run"
              >
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">People (comma separated)</span>
              <input
                v-model="peopleText"
                class="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-accent/60"
                placeholder="Jojo, Alex, Sam"
              >
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">Receipt image</span>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="rounded-2xl border border-dashed border-stone-300 bg-white/80 px-4 py-3 text-sm"
              >
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">Bill text fallback</span>
              <textarea
                v-model="rawText"
                rows="10"
                class="rounded-[1.5rem] border border-stone-200 bg-white/90 px-4 py-3 font-mono text-sm outline-none transition focus:border-accent/60"
                placeholder="Paste OCR text or type a rough receipt here"
              />
            </label>

            <div class="flex flex-wrap items-center gap-3 pt-1">
              <button
                class="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
              >
                {{ loading ? 'Analyzing bill...' : 'Analyze and split' }}
              </button>
              <p class="text-sm text-muted">
                `npm run dev` starts the local Postgres container before Nuxt.
              </p>
            </div>

            <p v-if="errorMessage" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ errorMessage }}
            </p>
          </form>

          <aside class="grid gap-4">
            <div class="rounded-[1.75rem] border border-white/60 bg-white/80 p-5 card-shadow">
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Status</p>
              <div class="mt-4 grid gap-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span>API route</span>
                  <span class="rounded-full bg-paper px-3 py-1">oRPC</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Pi image parsing</span>
                  <span class="rounded-full bg-paper px-3 py-1">
                    {{ health?.piReady ? 'enabled' : 'disabled' }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Saved runs</span>
                  <span class="rounded-full bg-paper px-3 py-1">Postgres</span>
                </div>
              </div>
            </div>

            <div class="rounded-[1.75rem] border border-white/60 bg-white/80 p-5 card-shadow">
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Setup notes</p>
              <ul class="mt-4 grid gap-3 text-sm leading-6 text-muted">
                <li v-for="idea in exampleIdeas" :key="idea">
                  {{ idea }}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section class="grid gap-6">
        <div class="rounded-[2rem] border border-white/60 bg-white/85 p-6 card-shadow">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Latest run</p>
              <h2 class="mt-2 font-serif text-3xl">
                {{ result?.title || 'No bill analyzed yet' }}
              </h2>
            </div>

            <div v-if="result" class="text-right text-sm text-muted">
              <p>Source: {{ result.source }}</p>
              <p>Run: {{ result.runId }}</p>
            </div>
          </div>

          <div v-if="result" class="mt-6 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Total</p>
                <p class="mt-2 text-2xl font-semibold">{{ formatCents(result.totalCents) }}</p>
              </div>
              <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Tax + Tip</p>
                <p class="mt-2 text-2xl font-semibold">
                  {{ formatCents((result.taxCents || 0) + (result.tipCents || 0)) }}
                </p>
              </div>
              <div class="rounded-[1.5rem] bg-paper px-4 py-4">
                <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Split mode</p>
                <p class="mt-2 text-2xl font-semibold">{{ result.pi.used ? 'Pi' : 'Local' }}</p>
              </div>
            </div>

            <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5">
              <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Summary</p>
              <p class="mt-3 text-sm leading-6">{{ result.summary }}</p>

              <div v-if="result.notes.length" class="mt-4 grid gap-2">
                <p class="text-xs font-medium tracking-[0.18em] text-muted uppercase">Notes</p>
                <p
                  v-for="note in result.notes"
                  :key="note"
                  class="rounded-2xl bg-paper px-3 py-2 text-sm text-muted"
                >
                  {{ note }}
                </p>
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
              <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5">
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Extracted items</p>
                <div class="mt-4 grid gap-3">
                  <div
                    v-for="item in result.items"
                    :key="`${item.name}-${item.amountCents}`"
                    class="flex items-center justify-between gap-4 rounded-2xl bg-paper px-4 py-3 text-sm"
                  >
                    <span>{{ item.name }}</span>
                    <span class="font-medium">{{ formatCents(item.amountCents) }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5">
                <p class="text-xs font-medium tracking-[0.24em] text-muted uppercase">Suggested split</p>
                <div class="mt-4 grid gap-3">
                  <div
                    v-for="entry in result.split"
                    :key="entry.person"
                    class="rounded-2xl bg-paper px-4 py-3"
                  >
                    <div class="flex items-center justify-between gap-4">
                      <span class="font-medium">{{ entry.person }}</span>
                      <span class="text-lg font-semibold">{{ formatCents(entry.amountCents) }}</span>
                    </div>
                    <p v-if="entry.note" class="mt-2 text-sm text-muted">{{ entry.note }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="mt-6 rounded-[1.75rem] border border-dashed border-stone-300 bg-paper/70 px-5 py-8 text-sm leading-6 text-muted"
          >
            Run the analyzer from the left side. The first pass is intentionally narrow:
            local receipt parsing, a Pi-backed image/text path when an OpenAI key exists, and a single saved bill run per request.
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

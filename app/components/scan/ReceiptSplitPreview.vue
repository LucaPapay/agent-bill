<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  imageSrc: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'idle',
  },
  title: {
    type: String,
    default: 'Receipt preview',
  },
  totalLabel: {
    type: String,
    default: '',
  },
})

const root = ref(null)

let timeline = null
let mediaQuery = null
let onMotionPreferenceChange = null
const reduceMotion = ref(false)

const statusLabel = computed(() => {
  if (props.status === 'extracting') {
    return 'Receipt being extracted'
  }

  if (props.status === 'agent') {
    return 'Penny is splitting it'
  }

  if (props.status === 'complete') {
    return 'Split locked in'
  }

  if (props.status === 'error') {
    return 'Scan needs another pass'
  }

  if (props.status === 'queued' || props.status === 'starting') {
    return 'Pipeline warming up'
  }

  return 'Ready to slice'
})

const ticketLabel = computed(() => {
  if (props.totalLabel) {
    return props.totalLabel
  }

  return statusLabel.value
})

function getNodes() {
  const stage = root.value

  if (!stage) {
    return null
  }

  return {
    burst: stage.querySelector('[data-burst]'),
    burstPieces: stage.querySelectorAll('[data-burst-piece]'),
    captionBar: stage.querySelector('[data-caption]'),
    claw: stage.querySelector('[data-claw]'),
    frame: stage.querySelector('[data-frame]'),
    glow: stage.querySelector('[data-glow]'),
    leftHalf: stage.querySelector('[data-half="left"]'),
    paperShards: stage.querySelectorAll('[data-paper-shard]'),
    rightHalf: stage.querySelector('[data-half="right"]'),
    slash: stage.querySelector('[data-slash]'),
    statChip: stage.querySelector('[data-stat-chip]'),
    ticket: stage.querySelector('[data-ticket]'),
  }
}

function setBurstPieceData(nodes) {
  const burstPositions = [
    ['-16', '-34', '-32', '-74'],
    ['14', '-36', '36', '-88'],
    ['30', '-10', '86', '-14'],
    ['-34', '-6', '-92', '0'],
    ['-18', '22', '-44', '62'],
    ['22', '28', '52', '78'],
  ]

  nodes.burstPieces.forEach((piece, index) => {
    const [x1, y1, x2, y2] = burstPositions[index] || burstPositions[0]
    piece.dataset.x1 = x1
    piece.dataset.y1 = y1
    piece.dataset.x2 = x2
    piece.dataset.y2 = y2
  })
}

function setPaperShardData(nodes) {
  const shardPositions = [
    ['-20', '-12', '-46', '-24', '-84', '-44', '-14', '-28', '-42'],
    ['18', '-26', '42', '-48', '72', '-96', '18', '34', '58'],
    ['26', '4', '54', '10', '104', '10', '22', '52', '96'],
    ['-10', '18', '-18', '48', '-32', '92', '-28', '22', '124'],
    ['12', '24', '26', '48', '58', '86', '34', '16', '-76'],
  ]

  nodes.paperShards.forEach((piece, index) => {
    const [x1, y1, xHold, yHold, x2, y2, r1, rHold, r2] = shardPositions[index] || shardPositions[0]
    piece.dataset.x1 = x1
    piece.dataset.y1 = y1
    piece.dataset.xHold = xHold
    piece.dataset.yHold = yHold
    piece.dataset.x2 = x2
    piece.dataset.y2 = y2
    piece.dataset.r1 = r1
    piece.dataset.rHold = rHold
    piece.dataset.r2 = r2
  })
}

function setBaseState(nodes) {
  gsap.set(nodes.frame, { opacity: 0, rotate: -4, scale: 0.92, y: 24 })
  gsap.set(nodes.claw, {
    opacity: 1,
    rotate: -6,
    scaleX: -1,
    scaleY: 1,
    transformOrigin: '86% 48%',
    x: 80,
    y: -8,
  })
  gsap.set(nodes.leftHalf, {
    clipPath: 'polygon(0 0, 58% 0, 48% 100%, 0 100%)',
    filter: 'drop-shadow(0 18px 24px rgba(0, 0, 0, 0.18))',
    rotate: 0,
    transformOrigin: '55% 50%',
    x: 0,
    y: 0,
  })
  gsap.set(nodes.rightHalf, {
    clipPath: 'polygon(52% 0, 100% 0, 100% 100%, 42% 100%)',
    filter: 'drop-shadow(0 18px 24px rgba(0, 0, 0, 0.18))',
    rotate: 0,
    transformOrigin: '45% 50%',
    x: 0,
    y: 0,
  })
  gsap.set(nodes.slash, {
    opacity: 0,
    rotate: -6,
    scaleY: 0,
    transformOrigin: 'center center',
  })
  gsap.set(nodes.glow, {
    opacity: 0,
    scale: 0.3,
    xPercent: -50,
    yPercent: -50,
  })
  gsap.set(nodes.burst, { opacity: 0, scale: 0.4 })
  gsap.set(nodes.burstPieces, {
    rotate: 0,
    scale: 1,
    transformOrigin: 'center center',
    x: 0,
    y: 0,
  })
  gsap.set(nodes.paperShards, {
    opacity: 0,
    rotate: 0,
    scale: 0.7,
    transformOrigin: 'center center',
    x: 0,
    y: 0,
  })
  gsap.set([nodes.captionBar, nodes.statChip], { opacity: 0, y: 20 })
  gsap.set(nodes.ticket, { opacity: 0, rotate: 7, y: -18 })
}

function setReducedMotionState(nodes) {
  gsap.set(nodes.frame, { opacity: 1, rotate: 0, scale: 1, x: 0, y: 0 })
  gsap.set(nodes.claw, {
    opacity: 1,
    rotate: -4,
    scaleX: -1,
    scaleY: 1,
    transformOrigin: '86% 48%',
    x: -56,
    y: -8,
  })
  gsap.set(nodes.leftHalf, {
    clipPath: 'polygon(0 0, 58% 0, 48% 100%, 0 100%)',
    rotate: -15,
    x: -112,
    y: 24,
  })
  gsap.set(nodes.rightHalf, {
    clipPath: 'polygon(52% 0, 100% 0, 100% 100%, 42% 100%)',
    rotate: 15,
    x: 112,
    y: -18,
  })
  gsap.set(nodes.slash, { opacity: 0 })
  gsap.set(nodes.glow, { opacity: 0 })
  gsap.set(nodes.burst, { opacity: 0 })
  gsap.set(nodes.burstPieces, { opacity: 0 })
  gsap.set(nodes.paperShards, { opacity: 0 })
  gsap.set([nodes.captionBar, nodes.statChip, nodes.ticket], { opacity: 1, y: 0, rotate: 0 })
}

function killTimeline() {
  if (!timeline) {
    return
  }

  timeline.kill()
  timeline = null
}

async function replay() {
  await nextTick()

  const nodes = getNodes()

  if (!nodes) {
    return
  }

  killTimeline()
  setBurstPieceData(nodes)
  setPaperShardData(nodes)

  if (reduceMotion.value) {
    setReducedMotionState(nodes)
    return
  }

  setBaseState(nodes)

  timeline = gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
  })

  timeline
    .to(nodes.frame, {
      duration: 0.9,
      ease: 'elastic.out(1, 0.8)',
      opacity: 1,
      rotate: 0,
      scale: 1,
      y: 0,
    })
    .to(
      nodes.ticket,
      {
        duration: 0.45,
        opacity: 1,
        rotate: -4,
        y: 0,
      },
      0.28,
    )
    .to(
      [nodes.captionBar, nodes.statChip],
      {
        duration: 0.45,
        opacity: 1,
        stagger: 0.08,
        y: 0,
      },
      0.4,
    )
    .to(
      nodes.claw,
      {
        duration: 0.24,
        ease: 'power2.out',
        rotate: -4,
        x: -56,
        y: -8,
      },
      0.56,
    )
    .to(
      nodes.claw,
      {
        ease: 'sine.inOut',
        keyframes: [
          { duration: 0.18, rotate: -18, x: -62, y: -10 },
          { duration: 0.18, rotate: 10, x: -48, y: -6 },
          { duration: 0.18, rotate: -15, x: -64, y: -11 },
          { duration: 0.16, rotate: 7, x: -50, y: -7 },
          { duration: 0.14, rotate: -4, x: -56, y: -8 },
        ],
      },
      0.8,
    )
    .to(
      nodes.claw,
      {
        duration: 0.52,
        ease: 'back.out(1.9)',
        rotate: -12,
        scaleX: -1,
        scaleY: 1,
        x: -120,
        y: 0,
      },
      1.72,
    )
    .to(
      nodes.claw,
      {
        ease: 'power4.inOut',
        keyframes: [
          { duration: 0.08, rotate: -21, x: -150, y: 7 },
          { duration: 0.1, rotate: -9, x: -116, y: -1 },
          { duration: 0.09, rotate: -17, x: -138, y: 4 },
        ],
      },
      2.24,
    )
    .to(
      nodes.slash,
      {
        duration: 0.09,
        ease: 'power4.out',
        opacity: 1,
        scaleY: 1.18,
      },
      2.28,
    )
    .to(
      nodes.glow,
      {
        duration: 0.12,
        ease: 'power2.out',
        opacity: 0.95,
        scale: 1,
      },
      2.28,
    )
    .to(
      nodes.burst,
      {
        duration: 0.18,
        ease: 'power2.out',
        opacity: 1,
        scale: 1.18,
      },
      2.3,
    )
    .to(
      nodes.burstPieces,
      {
        ease: 'power2.out',
        keyframes: [
          { duration: 0.1, rotate: 12, x: (_, target) => target.dataset.x1, y: (_, target) => target.dataset.y1 },
          { duration: 0.42, rotate: -22, scale: 0.12, x: (_, target) => target.dataset.x2, y: (_, target) => target.dataset.y2 },
        ],
        stagger: 0.015,
      },
      2.3,
    )
    .to(
      nodes.paperShards,
      {
        ease: 'power2.out',
        keyframes: [
          {
            duration: 0.14,
            opacity: 1,
            rotate: (_, target) => target.dataset.r1,
            scale: 1.04,
            x: (_, target) => target.dataset.x1,
            y: (_, target) => target.dataset.y1,
          },
          {
            duration: 0.24,
            opacity: 1,
            rotate: (_, target) => target.dataset.rHold,
            scale: 0.92,
            x: (_, target) => target.dataset.xHold,
            y: (_, target) => target.dataset.yHold,
          },
          {
            duration: 0.72,
            opacity: 0,
            rotate: (_, target) => target.dataset.r2,
            scale: 0.42,
            x: (_, target) => target.dataset.x2,
            y: (_, target) => target.dataset.y2,
          },
        ],
        stagger: 0.03,
      },
      2.29,
    )
    .to(
      [nodes.leftHalf, nodes.rightHalf],
      {
        keyframes: [
          {
            duration: 0.07,
            ease: 'power2.out',
            x: (_, target) => (target === nodes.leftHalf ? -28 : 28),
            y: -10,
          },
          {
            duration: 0.5,
            ease: 'power3.out',
            rotate: (_, target) => (target === nodes.leftHalf ? -18 : 18),
            x: (_, target) => (target === nodes.leftHalf ? -126 : 126),
            y: (_, target) => (target === nodes.leftHalf ? 30 : -24),
          },
          {
            duration: 0.28,
            ease: 'back.out(1.6)',
            rotate: (_, target) => (target === nodes.leftHalf ? -15 : 15),
            x: (_, target) => (target === nodes.leftHalf ? -112 : 112),
            y: (_, target) => (target === nodes.leftHalf ? 24 : -18),
          },
        ],
      },
      2.32,
    )
    .to(
      nodes.frame,
      {
        ease: 'power2.inOut',
        keyframes: [
          { duration: 0.06, rotate: 1.9, x: 18 },
          { duration: 0.08, rotate: -1.7, x: -15 },
          { duration: 0.07, rotate: 0.9, x: 10 },
          { duration: 0.16, rotate: 0, x: 0 },
        ],
      },
      2.32,
    )
    .to(
      nodes.claw,
      {
        duration: 0.34,
        ease: 'power3.in',
        rotate: -3,
        scaleX: -1,
        scaleY: 1,
        x: 140,
        y: -12,
      },
      2.48,
    )
    .to(
      nodes.slash,
      {
        duration: 0.14,
        opacity: 0,
        scaleY: 0,
      },
      2.54,
    )
    .to(
      nodes.glow,
      {
        duration: 0.24,
        ease: 'power2.out',
        opacity: 0.32,
        scale: 1.3,
      },
      2.38,
    )
    .to(
      nodes.glow,
      {
        duration: 0.9,
        ease: 'sine.out',
        opacity: 0,
        scale: 1.55,
      },
      2.64,
    )
    .to(
      nodes.burst,
      {
        duration: 0.24,
        opacity: 0,
      },
      2.62,
    )
    .to(
      [nodes.leftHalf, nodes.rightHalf],
      {
        duration: 1.3,
        ease: 'sine.inOut',
        repeat: -1,
        y: (_, target) => (target === nodes.leftHalf ? 8 : -8),
        yoyo: true,
      },
      3,
    )
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = mediaQuery.matches
  onMotionPreferenceChange = (event) => {
    reduceMotion.value = event.matches
    void replay()
  }
  mediaQuery.addEventListener('change', onMotionPreferenceChange)
  void replay()
})

watch(() => props.imageSrc, () => {
  void replay()
})

onBeforeUnmount(() => {
  if (mediaQuery && onMotionPreferenceChange) {
    mediaQuery.removeEventListener('change', onMotionPreferenceChange)
  }

  killTimeline()
})
</script>

<template>
  <div ref="root" class="receipt-split-stage">
    <div class="receipt-split-ambient receipt-split-ambient-one"></div>
    <div class="receipt-split-ambient receipt-split-ambient-two"></div>
    <div class="receipt-split-ticket mono" data-ticket>
      {{ ticketLabel }}
    </div>

    <div class="receipt-split-frame" data-frame>
      <div class="receipt-split-halo"></div>
      <div class="receipt-split-shadow"></div>

      <div class="receipt-split-image-stack">
        <div class="receipt-split-half" data-half="left">
          <img :src="imageSrc" :alt="title">
        </div>
        <div class="receipt-split-half" data-half="right">
          <img :src="imageSrc" alt="">
        </div>
      </div>

      <div class="receipt-split-slash" data-slash></div>
      <div class="receipt-split-glow" data-glow></div>

      <div class="receipt-split-burst" data-burst aria-hidden="true">
        <span v-for="index in 6" :key="`burst-${index}`" data-burst-piece></span>
      </div>

      <div class="receipt-split-paper-shards" aria-hidden="true">
        <span v-for="index in 5" :key="`shard-${index}`" data-paper-shard></span>
      </div>

      <img
        class="receipt-split-claw"
        data-claw
        src="/assets/lobster-claw.png"
        alt=""
      >

      <div class="receipt-split-caption" data-caption>
        <div>
          <p class="receipt-split-caption-label mono">
            Penny mode
          </p>
          <p class="receipt-split-caption-title">
            {{ title }}
          </p>
          <p class="receipt-split-caption-copy">
            {{ statusLabel }}
          </p>
        </div>

        <button class="receipt-split-replay" type="button" @click="replay">
          Replay cut
        </button>
      </div>
    </div>

    <div class="receipt-split-stat-chip mono" data-stat-chip>
      <span>Status</span>
      <strong>{{ status }}</strong>
    </div>
  </div>
</template>

<style scoped>
.receipt-split-stage {
  position: relative;
  min-height: 320px;
  height: 100%;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(255, 84, 54, 0.16), transparent 34%),
    radial-gradient(circle at 86% 18%, rgba(246, 181, 51, 0.22), transparent 26%),
    linear-gradient(180deg, #191511 0%, #0f0d0b 100%);
}

.receipt-split-ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(20px);
  pointer-events: none;
}

.receipt-split-ambient-one {
  inset: auto auto 18px -36px;
  width: 140px;
  height: 140px;
  background: rgba(255, 90, 59, 0.16);
}

.receipt-split-ambient-two {
  inset: -22px -20px auto auto;
  width: 160px;
  height: 160px;
  background: rgba(245, 182, 51, 0.16);
}

.receipt-split-ticket {
  position: absolute;
  top: 16px;
  right: 18px;
  z-index: 4;
  max-width: calc(100% - 36px);
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--marigold);
  box-shadow: 0 12px 24px rgba(245, 182, 51, 0.28);
  color: var(--ink);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.receipt-split-frame {
  position: relative;
  min-height: 320px;
  height: 100%;
  padding: 78px 16px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 26px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(31, 26, 23, 0.96), rgba(16, 14, 13, 0.98)),
    #171412;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 28px 60px rgba(10, 8, 6, 0.32);
}

.receipt-split-halo {
  position: absolute;
  inset: 12% 14% auto;
  height: 46%;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 90, 59, 0.34) 0%, rgba(255, 90, 59, 0.04) 46%, transparent 72%);
  filter: blur(8px);
}

.receipt-split-shadow {
  position: absolute;
  inset: auto 16% 26%;
  height: 30px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.34);
  filter: blur(18px);
}

.receipt-split-image-stack {
  position: absolute;
  inset: 72px 28px 112px;
  display: grid;
  place-items: center;
}

.receipt-split-half {
  position: absolute;
  inset: 0;
}

.receipt-split-half img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  user-select: none;
  pointer-events: none;
}

.receipt-split-slash {
  position: absolute;
  top: 20%;
  left: 49.5%;
  width: 10px;
  height: 48%;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff6e7 0%, var(--marigold) 24%, var(--tomato) 78%, transparent 100%);
  box-shadow: 0 0 28px rgba(255, 149, 63, 0.45);
}

.receipt-split-glow {
  position: absolute;
  top: 45%;
  left: 50%;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 240, 209, 0.94) 0%, rgba(255, 183, 76, 0.46) 24%, rgba(255, 90, 59, 0.22) 46%, transparent 72%);
  filter: blur(8px);
  z-index: 3;
  pointer-events: none;
}

.receipt-split-claw {
  position: absolute;
  top: 62px;
  right: -30px;
  width: clamp(180px, 48vw, 250px);
  z-index: 4;
  pointer-events: none;
  filter: drop-shadow(0 22px 30px rgba(0, 0, 0, 0.28));
  will-change: transform;
}

.receipt-split-burst,
.receipt-split-paper-shards {
  position: absolute;
  top: 44%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 5;
  pointer-events: none;
}

.receipt-split-burst span {
  position: absolute;
  display: block;
  width: 18px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, #fff2d0, var(--marigold) 60%, var(--tomato));
  box-shadow: 0 0 16px rgba(255, 146, 72, 0.34);
}

.receipt-split-burst span:nth-child(2n) {
  width: 10px;
}

.receipt-split-paper-shards span {
  position: absolute;
  display: block;
  width: 24px;
  height: 14px;
  background: linear-gradient(135deg, #fffaf0, #f2e3c5);
  border: 2px solid rgba(27, 22, 18, 0.16);
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.12);
  clip-path: polygon(6% 28%, 84% 0, 100% 58%, 22% 100%, 0 68%);
}

.receipt-split-paper-shards span:nth-child(2n) {
  width: 18px;
  height: 12px;
}

.receipt-split-paper-shards span:nth-child(3) {
  width: 14px;
  height: 14px;
  clip-path: polygon(50% 0, 100% 44%, 72% 100%, 0 74%, 10% 18%);
}

.receipt-split-caption {
  position: relative;
  z-index: 2;
  margin-top: auto;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 14px;
  border-radius: 20px;
  background: rgba(245, 237, 223, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.receipt-split-caption-label {
  margin: 0 0 6px;
  color: rgba(22, 19, 15, 0.48);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.receipt-split-caption-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.receipt-split-caption-copy {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.receipt-split-replay {
  flex: 0 0 auto;
  padding: 12px 16px;
  border-radius: 999px;
  background: var(--tomato);
  color: var(--cream);
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 14px 28px rgba(255, 90, 59, 0.28);
}

.receipt-split-stat-chip {
  position: absolute;
  right: 28px;
  bottom: 26px;
  z-index: 5;
  padding: 9px 12px;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  border-radius: 999px;
  background: rgba(17, 14, 11, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  color: rgba(255, 247, 236, 0.82);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.receipt-split-stat-chip strong {
  color: #fff5e9;
  font-size: 11px;
}

@media (max-width: 640px) {
  .receipt-split-stage {
    padding: 12px;
  }

  .receipt-split-frame {
    padding: 74px 12px 12px;
  }

  .receipt-split-image-stack {
    inset: 72px 16px 122px;
  }

  .receipt-split-claw {
    top: 74px;
    right: -34px;
    width: 190px;
  }

  .receipt-split-caption {
    flex-direction: column;
    align-items: stretch;
  }

  .receipt-split-replay {
    width: 100%;
  }

  .receipt-split-stat-chip {
    right: 22px;
    bottom: 18px;
  }
}
</style>

<script setup>
import { nextTick, ref, watch } from 'vue'
import IconGlyph from '../app/IconGlyph.vue'
import ReceiptSplitPreview from './ReceiptSplitPreview.vue'
import PennyLoadingIndicator from './PennyLoadingIndicator.vue'
import ScanReceiptCard from './ScanReceiptCard.vue'
import ScanToolCallRow from './ScanToolCallRow.vue'

const props = defineProps({
  blocks: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['open-bill-composer', 'pick-group'])
const scrollRef = ref(null)

function scrollToBottom() {
  nextTick(() => {
    if (!scrollRef.value) {
      return
    }

    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

function getMessageAvatarClass(who) {
  return who === 'system' ? 'system' : ''
}

function getMessageAvatarName(who) {
  return who === 'system' ? 'scan' : 'sparkle'
}

function getMessageRowClass(who) {
  if (who === 'user') {
    return 'user'
  }

  if (who === 'system') {
    return 'system'
  }

  return ''
}

function getMessageBubbleClass(who) {
  if (who === 'user') {
    return 'user'
  }

  if (who === 'system') {
    return 'system'
  }

  return 'assistant'
}

watch(() => props.blocks, scrollToBottom, { deep: true })
</script>

<template>
  <div
    ref="scrollRef"
    class="chat-stream scan-chat-stream"
  >
    <template v-for="block in blocks" :key="block.id">
      <div
        v-if="block.kind === 'message'"
        class="scan-chat-row"
        :class="getMessageRowClass(block.who)"
      >
        <div v-if="block.who !== 'user'" class="scan-avatar" :class="getMessageAvatarClass(block.who)">
          <IconGlyph :name="getMessageAvatarName(block.who)" width="16" height="16" />
        </div>
        <div class="scan-bubble" :class="getMessageBubbleClass(block.who)">
          {{ block.text }}
        </div>
      </div>

      <div v-else-if="block.kind === 'empty-groups'" class="scan-chat-row">
        <div class="scan-avatar system">
          <IconGlyph name="groups" width="16" height="16" />
        </div>
        <div class="scan-bubble system">
          <div>No local groups exist yet.</div>
          <div class="scan-choice-row">
            <NuxtLink class="scan-choice-button scan-choice-link" to="/groups">
              Open groups
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-else-if="block.kind === 'preview'" class="scan-chat-row">
        <div class="scan-avatar">
          <IconGlyph name="sparkle" width="16" height="16" />
        </div>
        <div class="scan-preview-stage">
          <ReceiptSplitPreview
            :image-src="block.imageSrc"
            :status="block.status"
            :title="block.title"
            :total-label="block.totalLabel"
          />
        </div>
      </div>

      <div v-else-if="block.kind === 'group-picker'" class="scan-choice-row scan-choice-row-inline">
        <button
          v-for="group in block.groups"
          :key="group.id"
          type="button"
          class="scan-choice-button"
          @click="emit('pick-group', group.id)"
        >
          {{ group.name }}
        </button>
      </div>

      <div v-else-if="block.kind === 'error'" class="scan-chat-row system">
        <div class="scan-avatar system">
          <IconGlyph name="scan" width="16" height="16" />
        </div>
        <div class="scan-bubble system error">
          {{ block.text }}
        </div>
      </div>

      <div v-else-if="block.kind === 'receipt'" class="scan-chat-row">
        <div class="scan-avatar">
          <IconGlyph name="sparkle" width="16" height="16" />
        </div>

        <ScanReceiptCard
          :receipt="block.receipt"
          :split-rows="block.splitRows"
          :summary="block.summary"
          :visible-notes="block.visibleNotes"
        />
      </div>

      <div v-else-if="block.kind === 'composer-cta'" class="scan-chat-row">
        <div class="scan-avatar">
          <IconGlyph name="sparkle" width="16" height="16" />
        </div>
        <button type="button" class="btn scan-composer-toggle" @click="emit('open-bill-composer')">
          {{ block.label }}
        </button>
      </div>

      <ScanToolCallRow
        v-else-if="block.kind === 'tool'"
        :state="block.state"
        :tool-name="block.toolName"
      />

      <PennyLoadingIndicator
        v-else-if="block.kind === 'loading'"
        :loading-chat="block.loadingChat"
        :status="block.status"
      />
    </template>
  </div>
</template>

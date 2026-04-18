<script setup>
import ScanChatComposer from '../scan/ScanChatComposer.vue'
import ScanChatTranscript from '../scan/ScanChatTranscript.vue'
import { useScanScreenState } from '../../composables/useScanScreenState'

const props = defineProps({
  chatId: {
    type: String,
    default: '',
  },
})

const {
  cameraInput,
  canPickReceipt,
  canRecordVoice,
  canReset,
  canSend,
  clearGroup,
  composerPlaceholder,
  composerText,
  fileInput,
  headerStatus,
  isRecordingVoice,
  isTranscribingVoice,
  onFileChange,
  onPickGroupId,
  onSend,
  openBillComposerFromScan,
  openReceiptPicker,
  resetScan,
  selectedGroup,
  showShellTitle,
  showVoiceButton,
  toggleVoiceInput,
  transcriptBlocks,
  uploadLabel,
  voiceStatusLabel,
} = useScanScreenState(props)
</script>

<template>
  <div class="screen scan-chat-screen">
    <section class="section-pad scan-chat-wrap">
      <div class="scan-chat-shell">
        <div class="scan-chat-shell-head">
          <div>
            <div class="scan-panel-kicker scan-panel-kicker-on-dark">
              Scan chat
            </div>
            <div v-if="showShellTitle" class="scan-chat-shell-title">
              Chat first. Receipt next.
            </div>
          </div>

          <div class="scan-chat-shell-meta">
            <div class="scan-shell-chip">
              {{ selectedGroup ? selectedGroup.name : 'No group' }}
            </div>
            <div class="scan-shell-chip">
              {{ headerStatus }}
            </div>
          </div>
        </div>

        <ScanChatTranscript
          :blocks="transcriptBlocks"
          @open-bill-composer="openBillComposerFromScan"
          @pick-group="onPickGroupId"
        />

        <ScanChatComposer
          v-model="composerText"
          :can-pick-receipt="canPickReceipt"
          :can-record-voice="canRecordVoice"
          :can-reset="canReset"
          :can-send="canSend"
          :composer-placeholder="composerPlaceholder"
          :is-recording-voice="isRecordingVoice"
          :is-transcribing-voice="isTranscribingVoice"
          :selected-group-name="selectedGroup ? selectedGroup.name : ''"
          :show-voice-button="showVoiceButton"
          :upload-label="uploadLabel"
          :voice-status-label="voiceStatusLabel"
          @clear-group="clearGroup"
          @pick-receipt="openReceiptPicker"
          @reset="resetScan"
          @send="onSend"
          @toggle-voice="toggleVoiceInput"
        />
      </div>
    </section>

    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="scan-hidden-input"
      @change="onFileChange"
    >

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="scan-hidden-input"
      @change="onFileChange"
    >
  </div>
</template>

<style>
.scan-chat-screen {
  min-height: 100vh;
  min-height: 100dvh;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  padding-bottom: 32px;
}

.scan-chat-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 18px;
}

.scan-chat-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(246, 181, 51, 0.14), transparent 28%),
    linear-gradient(180deg, #151311 0%, #231b16 100%);
  border: 1px solid rgba(20, 18, 16, 0.08);
  box-shadow: 0 28px 60px rgba(38, 24, 10, 0.18);
}

.scan-chat-shell-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 20px 20px 0;
}

.scan-panel-kicker {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.scan-panel-kicker-on-dark {
  color: rgba(246, 240, 228, 0.6);
}

.scan-chat-shell-title {
  margin-top: 8px;
  color: var(--cream);
  font-size: clamp(28px, 6vw, 44px);
  line-height: 0.95;
  max-width: 10ch;
}

.scan-chat-shell-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.scan-shell-chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  font-size: 12px;
  font-weight: 600;
}

.scan-chat-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.scan-chat-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.scan-chat-row.user {
  justify-content: flex-end;
}

.scan-avatar {
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

.scan-avatar.system {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(246, 240, 228, 0.7);
}

.scan-bubble {
  max-width: min(100%, 680px);
  border-radius: 22px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
}

.scan-bubble.assistant,
.scan-bubble.system {
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
}

.scan-bubble.user {
  background: var(--cream);
  color: var(--ink);
}

.scan-bubble.error {
  border: 1px solid rgba(255, 84, 54, 0.32);
  color: #ffd2ca;
}

.scan-tool-call {
  width: min(100%, 680px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.scan-tool-call-copy {
  font-size: 14px;
  font-weight: 600;
}

.scan-tool-call-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(246, 181, 51, 0.9);
  box-shadow: 0 0 0 4px rgba(246, 181, 51, 0.12);
}

.scan-tool-call.is-running {
  border: 1px solid rgba(246, 181, 51, 0.16);
}

.scan-tool-call.is-error {
  border: 1px solid rgba(255, 84, 54, 0.32);
}

.scan-choice-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scan-choice-row-inline {
  padding-left: 42px;
}

.scan-choice-button {
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: var(--cream);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.scan-choice-link {
  display: inline-flex;
  align-items: center;
}

.scan-composer-toggle {
  background: var(--marigold);
  color: var(--ink);
  border: 1.5px solid var(--marigold);
}

.scan-preview-stage {
  width: min(100%, 720px);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.18);
}

.scan-preview-stage .receipt-split-stage {
  min-height: 320px;
}

.scan-receipt-card {
  width: min(100%, 720px);
  border-radius: 24px;
  background: rgba(251, 247, 238, 0.96);
  color: var(--ink);
  padding: 18px;
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.12);
}

.scan-composer-stage {
  width: min(100%, 1080px);
  border-radius: 24px;
  overflow: hidden;
  background: rgba(251, 247, 238, 0.96);
  box-shadow: 0 20px 38px rgba(24, 16, 10, 0.12);
}

.scan-receipt-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.scan-receipt-head-side {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.scan-receipt-kicker {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-receipt-title {
  margin-top: 6px;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
}

.scan-receipt-total {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}

.scan-receipt-time {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(20, 18, 16, 0.58);
}

.scan-receipt-summary {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(20, 18, 16, 0.72);
}

.scan-receipt-items {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.scan-split-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(20, 18, 16, 0.05);
}

.scan-split-empty {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(20, 18, 16, 0.05);
}

.scan-split-empty-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(20, 18, 16, 0.65);
}

.scan-split-empty-copy {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
}

.scan-split-empty-example {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(20, 18, 16, 0.68);
}

.scan-item-row,
.scan-mini-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.scan-item-row {
  font-size: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(20, 18, 16, 0.08);
}

.scan-item-name {
  font-weight: 600;
}

.scan-receipt-totals {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(20, 18, 16, 0.1);
  font-size: 13px;
  color: rgba(20, 18, 16, 0.7);
}

.scan-mini-row.total {
  font-weight: 700;
  color: var(--ink);
}

.scan-total-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.scan-total-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(143, 197, 106, 0.18);
  color: #4d7f31;
  font-size: 12px;
  line-height: 1;
}

.scan-receipt-notes {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.scan-note-row {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(20, 18, 16, 0.05);
  font-size: 12px;
  line-height: 1.45;
}

.scan-chat-footer {
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.scan-composer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.scan-composer-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  min-width: 0;
  min-height: 52px;
  padding: 6px 14px 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.scan-upload-trigger,
.scan-voice-trigger,
.scan-send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.scan-upload-trigger {
  min-width: 116px;
  background: var(--marigold);
  color: var(--ink);
}

.scan-voice-trigger {
  position: relative;
  overflow: hidden;
  background: var(--tomato);
  color: var(--cream);
}

.scan-voice-trigger-inline {
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  border: 0;
  background: var(--tomato);
  box-shadow: 0 8px 20px rgba(255, 84, 54, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
}

.scan-voice-trigger.is-recording {
  background: var(--tomato);
  color: var(--cream);
  box-shadow: 0 0 0 3px rgba(255, 84, 54, 0.18), inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

.scan-voice-trigger.is-busy {
  background: var(--tomato);
  color: var(--cream);
  opacity: 0.72;
}

.scan-send-button {
  min-width: 92px;
  background: var(--cream);
  color: var(--ink);
}

.scan-upload-trigger:disabled,
.scan-voice-trigger:disabled,
.scan-send-button:disabled {
  opacity: 0.55;
}

.scan-composer-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--cream);
  padding: 0;
  outline: none;
}

.scan-composer-input-wrap.has-voice-button .scan-composer-input {
  padding-left: 0;
}

.scan-composer-input::placeholder {
  color: rgba(246, 240, 228, 0.45);
}

.scan-footer-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.scan-footer-link {
  border: 0;
  background: transparent;
  color: rgba(246, 240, 228, 0.72);
  padding: 0;
  font-size: 13px;
  font-weight: 600;
}

.scan-voice-status {
  color: rgba(246, 240, 228, 0.72);
  font-size: 13px;
  font-weight: 600;
}

.scan-voice-status.is-error {
  color: #ffd2ca;
}

.scan-hidden-input {
  display: none;
}

@media (min-width: 768px) {
  .scan-chat-screen {
    min-height: calc(100vh - 120px);
    min-height: calc(100dvh - 120px);
    height: calc(100vh - 120px);
    height: calc(100dvh - 120px);
    padding-bottom: 16px;
  }
}

@media (max-width: 720px) {
  .scan-chat-shell {
    border-radius: 24px;
  }

  .scan-chat-shell-head {
    flex-direction: column;
  }

  .scan-chat-shell-meta {
    justify-content: flex-start;
  }

  .scan-choice-row-inline {
    padding-left: 0;
  }

  .scan-composer {
    grid-template-columns: 1fr;
  }

  .scan-upload-trigger,
  .scan-send-button {
    width: 100%;
  }
}
</style>

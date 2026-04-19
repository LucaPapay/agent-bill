<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps({
  disabled: Boolean,
  modelValue: {
    type: String,
    default: '',
  },
  allowEmpty: Boolean,
  placeholder: {
    type: String,
    default: '0,00€',
  },
})

const emit = defineEmits(['update:modelValue'])

const isFocused = ref(false)
const draftValue = ref(editableValue(props.modelValue, props.allowEmpty))

const displayValue = computed(() => {
  if (isFocused.value) {
    return draftValue.value
  }

  return formattedValue(props.modelValue, props.allowEmpty)
})

watch(() => props.modelValue, (value) => {
  if (isFocused.value) {
    return
  }

  draftValue.value = editableValue(value, props.allowEmpty)
})

function toCents(value: string | number | undefined | null) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.')
  const amount = Number.parseFloat(normalized)

  if (!Number.isFinite(amount)) {
    return 0
  }

  return Math.max(0, Math.round(amount * 100))
}

function centsToEditable(cents: number) {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',')
}

function sanitizeEditableValue(value: string | number | undefined | null) {
  return String(value || '')
    .replace(/[€\s]/g, '')
    .replace(/[^0-9,.-]/g, '')
}

function editableValue(value: string | number | undefined | null, allowEmpty: boolean) {
  if (allowEmpty && !String(value || '').trim()) {
    return ''
  }

  return centsToEditable(toCents(value))
}

function formattedValue(value: string | number | undefined | null, allowEmpty: boolean) {
  if (allowEmpty && !String(value || '').trim()) {
    return ''
  }

  return `${editableValue(value, allowEmpty)}€`
}

function onFocus() {
  isFocused.value = true
  draftValue.value = editableValue(props.modelValue, props.allowEmpty)
}

function onInput(event: Event) {
  const nextValue = sanitizeEditableValue((event.target as HTMLInputElement).value)
  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
}

function onBlur() {
  isFocused.value = false
  const nextValue = editableValue(draftValue.value, props.allowEmpty)
  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
}
</script>

<template>
  <input
    :value="displayValue"
    type="text"
    inputmode="decimal"
    :placeholder="placeholder"
    :disabled="disabled"
    @focus="onFocus"
    @input="onInput"
    @blur="onBlur"
  >
</template>

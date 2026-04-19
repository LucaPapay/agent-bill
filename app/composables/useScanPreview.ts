import { ref } from 'vue'

export function useScanPreview() {
  const cameraInput = ref<any>(null)
  const fileInput = ref<any>(null)
  const previewUrl = ref('')
  const showCameraCapture = ref(false)

  function clearInputs() {
    if (cameraInput.value) {
      cameraInput.value.value = ''
    }

    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }

  function revokePreview() {
    if (!previewUrl.value) {
      return
    }

    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }

  function setFile(file: File) {
    revokePreview()
    previewUrl.value = URL.createObjectURL(file)
  }

  function openReceiptPicker(canPickReceipt: boolean) {
    if (!canPickReceipt) {
      return
    }

    clearInputs()

    if (showCameraCapture.value) {
      cameraInput.value?.click()
      return
    }

    fileInput.value?.click()
  }

  function onFileChange(event: any, onFile: (file: File) => void | Promise<void>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setFile(file)
    void onFile(file)
  }

  function setup() {
    showCameraCapture.value =
      window.matchMedia('(pointer: coarse)').matches
      || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  function teardown() {
    revokePreview()
  }

  return {
    cameraInput,
    clearInputs,
    fileInput,
    onFileChange,
    openReceiptPicker,
    previewUrl,
    revokePreview,
    setup,
    teardown,
  }
}

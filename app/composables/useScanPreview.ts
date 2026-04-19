import { ref } from 'vue'

export function useScanPreview() {
  const cameraInput = ref<any>(null)
  const fileInput = ref<any>(null)
  const showCameraCapture = ref(false)

  function clearInputs() {
    if (cameraInput.value) {
      cameraInput.value.value = ''
    }

    if (fileInput.value) {
      fileInput.value.value = ''
    }
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

    void onFile(file)
  }

  function setup() {
    showCameraCapture.value =
      window.matchMedia('(pointer: coarse)').matches
      || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  function teardown() {}

  return {
    cameraInput,
    clearInputs,
    fileInput,
    onFileChange,
    openReceiptPicker,
    setup,
    teardown,
  }
}

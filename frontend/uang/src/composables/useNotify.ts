import Swal from 'sweetalert2'

const classes = {
  popup: 'ft-swal',
  title: 'ft-swal-title',
  htmlContainer: 'ft-swal-text',
  actions: 'ft-swal-actions',
  cancelButton: 'ft-btn ft-btn-ghost',
  input: 'ft-swal-input',
  validationMessage: 'ft-swal-validation',
}

const dialog = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  focusCancel: true,
  scrollbarPadding: false,
  heightAuto: false,
})

const toastBase = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2800,
  timerProgressBar: true,
  scrollbarPadding: false,
  customClass: { popup: 'ft-toast', title: 'ft-toast-title' },
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer)
    el.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

export function useNotify() {
  async function confirmDelete(title: string, text?: string): Promise<boolean> {
    const result = await dialog.fire({
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      customClass: { ...classes, confirmButton: 'ft-btn ft-btn-danger' },
    })
    return result.isConfirmed
  }

  async function promptAmount(title: string, text?: string): Promise<number | null> {
    const result = await dialog.fire({
      title,
      text,
      input: 'number',
      inputAttributes: { min: '1', step: '1', inputmode: 'numeric' },
      inputPlaceholder: 'Jumlah dalam Rp',
      showCancelButton: true,
      confirmButtonText: 'Tambah',
      cancelButtonText: 'Batal',
      focusCancel: false,
      customClass: { ...classes, confirmButton: 'ft-btn ft-btn-primary' },
      inputValidator: (value) => (!value || Number(value) <= 0 ? 'Masukkan jumlah yang valid' : undefined),
    })
    return result.isConfirmed ? Number(result.value) : null
  }

  const toast = {
    success: (title: string) => toastBase.fire({ icon: 'success', title }),
    error: (title: string) => toastBase.fire({ icon: 'error', title, timer: 4500 }),
    info: (title: string) => toastBase.fire({ icon: 'info', title }),
  }

  return { confirmDelete, promptAmount, toast }
}

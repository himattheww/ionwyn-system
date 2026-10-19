export interface Toast {
  id: string
  title: string
  body: string
}

interface Props {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function NoticeBar({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <ul className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <li key={toast.id} className="toast">
          <div>
            <strong>{toast.title}</strong>
            <div className="meta">{toast.body}</div>
          </div>
          <button onClick={() => onDismiss(toast.id)} aria-label="Tutup">
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

const supported = () => typeof Notification !== 'undefined'

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  supported() ? Notification.permission : 'unsupported'

export const requestNotificationPermission = async () =>
  supported() ? Notification.requestPermission() : 'denied'

export const registerWorker = () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
}

export const showNotification = async (title: string, body: string) => {
  if (!supported() || Notification.permission !== 'granted') return
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) await registration.showNotification(title, { body, icon: '/icon.svg' })
  else new Notification(title, { body, icon: '/icon.svg' })
}

const key = (kind: string, date: string) => `sent:${kind}:${date}`

export const wasSent = (kind: string, date: string) => {
  try {
    return localStorage.getItem(key(kind, date)) === '1'
  } catch {
    return false
  }
}

export const markSent = (kind: string, date: string) => {
  try {
    localStorage.setItem(key(kind, date), '1')
  } catch {
    return
  }
}

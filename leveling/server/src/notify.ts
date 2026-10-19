import notifier from 'node-notifier'

export function desktopNotify(lines: string[]) {
  notifier.notify({ title: 'Leveling', message: lines.join('\n'), appID: 'Leveling' }, error => {
    if (error) console.error('Notifikasi desktop gagal:', error.message)
  })
}

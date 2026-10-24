export type Screen = 'home' | 'calendar' | 'routines' | 'history' | 'settings'

const tabs: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Hari ini' },
  { id: 'calendar', label: 'Kalender' },
  { id: 'routines', label: 'Rutinitas' },
  { id: 'history', label: 'Riwayat' },
  { id: 'settings', label: 'Pengaturan' },
]

export function Tabs({ screen, onChange, onSignOut }: { screen: Screen; onChange: (next: Screen) => void; onSignOut: () => void }) {
  return (
    <nav className="subnav" aria-label="Halaman Jadwal">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={`#${tab.id}`}
          aria-current={screen === tab.id ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            onChange(tab.id)
          }}
        >
          {tab.label}
        </a>
      ))}
      <button className="subnav-out" onClick={onSignOut}>
        Keluar
      </button>
    </nav>
  )
}

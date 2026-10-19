import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { client, configured } from './lib/supabase'
import { Login } from './components/Login'
import { Planner } from './components/Planner'

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!configured) return
    client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) {
    return (
      <main className="page">
        <p className="error">SUPABASE_URL dan SUPABASE_ANON_KEY belum ada di .env</p>
      </main>
    )
  }
  if (session === undefined) return <main className="page">Memuat…</main>
  if (session === null) return <Login />
  return <Planner onSignOut={() => client.auth.signOut()} />
}

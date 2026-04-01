import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) { console.error('Profile fetch failed:', error); setLoading(false); return }
    setProfile(data)
    // mark online
    await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // log login
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    await logActivity({
      userId: data.user.id,
      userName: prof?.name || email,
      actionType: ACTION_TYPES.LOGIN,
      entityType: ENTITY_TYPES.USER,
      description: `${prof?.name || email} התחבר/ה למערכת`,
    })
    return data
  }

  async function signOut() {
    if (user) {
      await supabase.from('profiles').update({ is_online: false }).eq('id', user.id)
      await logActivity({
        userId: user.id,
        userName: profile?.name || user.email,
        actionType: ACTION_TYPES.LOGOUT,
        entityType: ENTITY_TYPES.USER,
        description: `${profile?.name || user.email} התנתק/ה מהמערכת`,
      })
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

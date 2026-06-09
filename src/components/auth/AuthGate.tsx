import { Loader2, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { getMyProfile } from '../../lib/adminData'
import {
  getCurrentSession,
  getSupabaseStatus,
  supabase,
} from '../../lib/supabase'
import type { Profile } from '../../types/admin'
import { MessageState } from '../ui/AdminUi'
import { AdminLayout } from '../layout/AdminLayout'

export function AuthGate() {
  const [sessionReady, setSessionReady] = useState(() => !supabase)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const status = getSupabaseStatus()

  useEffect(() => {
    if (!supabase) {
      return
    }

    let cancelled = false

    getCurrentSession()
      .then((session) => {
        if (!cancelled) {
          if (session?.user.id) {
            setProfileLoading(true)
          }
          setSessionUserId(session?.user.id ?? null)
          setSessionReady(true)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setProfileError(error.message)
          setSessionReady(true)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id) {
        setProfileLoading(true)
      }
      setSessionUserId(session?.user.id ?? null)
      setProfile(null)
      setProfileError(null)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionUserId) {
      return
    }

    let cancelled = false

    getMyProfile(sessionUserId)
      .then((nextProfile) => {
        if (!cancelled) {
          setProfile(nextProfile)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setProfileError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionUserId])

  if (!status.configured) {
    return (
      <AuthFrame>
        <MessageState
          icon={ShieldAlert}
          title="Supabase is not configured"
          body="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the Vite server."
        />
      </AuthFrame>
    )
  }

  if (!sessionReady || profileLoading) {
    return (
      <AuthFrame>
        <MessageState
          icon={Loader2}
          title="Loading admin session"
          body="Checking Supabase Auth and the linked profile role."
        />
      </AuthFrame>
    )
  }

  if (!sessionUserId) {
    return <LoginScreen />
  }

  if (profileError) {
    return (
      <AuthFrame>
        <MessageState
          icon={ShieldAlert}
          title="Profile lookup failed"
          body={profileError}
        />
        <SignOutButton />
      </AuthFrame>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <AuthFrame>
        <MessageState
          icon={ShieldAlert}
          title="Admin access required"
          body="This website only allows profiles with role admin. Create or update the matching profiles row in Supabase before continuing."
        />
        <SignOutButton />
      </AuthFrame>
    )
  }

  return <AdminLayout profile={profile} />
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase!.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
    }

    setSubmitting(false)
  }

  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={onSubmit}>
        <img src="/bonibe_logo_primary.png" alt="Bonibe Bakeshop" />
        <div>
          <span className="eyebrow">Admin sign in</span>
          <h1>Bonibe Admin</h1>
          <p>Use a Supabase Auth account linked to an admin profile.</p>
        </div>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@bonibe.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-action" disabled={submitting} type="submit">
          {submitting ? <Loader2 size={18} /> : <ShieldCheck size={18} />}
          Sign In
        </button>
      </form>
    </AuthFrame>
  )
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="auth-screen">{children}</main>
}

function SignOutButton() {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label="Sign out"
      onClick={() => void supabase?.auth.signOut()}
    >
      <LogOut size={18} />
    </button>
  )
}

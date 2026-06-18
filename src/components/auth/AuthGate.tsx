import { Loader2, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
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
  const sessionUserIdRef = useRef<string | null>(null)
  const status = getSupabaseStatus()

  useEffect(() => {
    if (!supabase) {
      return
    }

    let cancelled = false

    withTimeout(
      getCurrentSession(),
      12000,
      'We could not finish checking your account. Please refresh and try again.',
    )
      .then((session) => {
        if (!cancelled) {
          const nextUserId = session?.user.id ?? null
          sessionUserIdRef.current = nextUserId
          setSessionUserId(nextUserId)
          setProfileLoading(Boolean(nextUserId))
          setSessionReady(true)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setProfileError(error.message)
          setProfileLoading(false)
          setSessionReady(true)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null

      setSessionReady(true)

      if (!nextUserId) {
        sessionUserIdRef.current = null
        setSessionUserId(null)
        setProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        return
      }

      if (sessionUserIdRef.current === nextUserId) {
        return
      }

      sessionUserIdRef.current = nextUserId
      setSessionUserId(nextUserId)
      setProfile(null)
      setProfileError(null)
      setProfileLoading(true)
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

    withTimeout(
      getMyProfile(sessionUserId),
      12000,
      'We could not load your admin account details. Please refresh and try again.',
    )
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
          title="Connection setup needed"
          body="The admin website is missing its connection settings. Please ask the setup team to finish the website configuration."
        />
      </AuthFrame>
    )
  }

  if (!sessionReady || profileLoading) {
    return (
      <AuthFrame>
        <MessageState
          icon={Loader2}
          title="Loading admin access"
          body="Checking your account and permissions."
        />
      </AuthFrame>
    )
  }

  if (profileError) {
    return (
      <AuthFrame>
        <MessageState
          icon={ShieldAlert}
          title="Account lookup failed"
          body={profileError}
        />
        <button
          className="primary-action retry-action"
          type="button"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
        <SignOutButton />
      </AuthFrame>
    )
  }

  if (!sessionUserId) {
    return <LoginScreen />
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <AuthFrame>
        <MessageState
          icon={ShieldAlert}
          title="Admin access required"
          body="This website is only for owner and admin accounts. Please sign in with an admin account."
        />
        <SignOutButton />
      </AuthFrame>
    )
  }

  return <AdminLayout profile={profile} />
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer))
  })
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
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Invalid login credentials. If this admin was created before the latest account fix, delete and recreate it so it gets a Supabase Auth login.'
          : signInError.message,
      )
    }

    setSubmitting(false)
  }

  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={onSubmit}>
        <img src="/bonibe_logo.jpg" alt="Bonibe Bakeshop" />
        <div>
          <span className="eyebrow">Admin sign in</span>
          <h1>Bonibe Admin</h1>
          <p>Sign in with your Bonibe owner or admin account.</p>
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

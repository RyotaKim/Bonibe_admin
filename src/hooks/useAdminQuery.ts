import { useEffect, useState } from 'react'

export function useAdminQuery<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    loader()
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData)
        }
      })
      .catch((nextError: Error) => {
        if (!cancelled) {
          setError(nextError.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loader, version])

  return {
    data,
    loading,
    error,
    reload: () => {
      setLoading(true)
      setError(null)
      setVersion((current) => current + 1)
    },
  }
}

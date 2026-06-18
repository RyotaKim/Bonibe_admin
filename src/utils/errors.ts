type ErrorLike = {
  message?: unknown
  details?: unknown
  hint?: unknown
  code?: unknown
  error_description?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (!isRecord(error)) {
    return String(error)
  }

  const errorLike = error as ErrorLike
  const parts = [
    errorLike.message,
    errorLike.details,
    errorLike.hint,
    errorLike.error_description,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .filter((part, index, items) => items.indexOf(part) === index)

  const code = typeof errorLike.code === 'string' ? errorLike.code : null

  if (parts.length && code) {
    return `${parts.join(' ')} (${code})`
  }

  if (parts.length) {
    return parts.join(' ')
  }

  return JSON.stringify(error)
}

export function createMutationError(action: string, error: unknown) {
  const message = formatError(error)

  return new Error(`${action}: ${message}`)
}

import { useState, type Dispatch, type SetStateAction } from 'react'
import { formatError } from '../utils/errors'

export type MutationStatus = {
  state: 'idle' | 'success' | 'error'
  message: string
}

export function useMutationStatus() {
  return useState<MutationStatus>({ state: 'idle', message: '' })
}

export async function runMutation(
  setStatus: Dispatch<SetStateAction<MutationStatus>>,
  mutation: () => Promise<unknown>,
  successMessage = 'Saved successfully.',
) {
  setStatus({ state: 'idle', message: '' })

  try {
    await mutation()
    setStatus({ state: 'success', message: successMessage })
    return true
  } catch (error) {
    setStatus({
      state: 'error',
      message: formatError(error),
    })
    return false
  }
}

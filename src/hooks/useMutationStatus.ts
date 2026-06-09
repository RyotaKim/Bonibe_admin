import { useState, type Dispatch, type SetStateAction } from 'react'

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
) {
  setStatus({ state: 'idle', message: '' })

  try {
    await mutation()
    setStatus({ state: 'success', message: 'Saved to Supabase.' })
  } catch (error) {
    setStatus({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'None'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en').format(value)
}

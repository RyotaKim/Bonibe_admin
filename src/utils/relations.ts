export function locationName(
  locations: Array<{ id: string; name: string }>,
  locationId: string | null,
) {
  if (!locationId) {
    return 'None'
  }

  return (
    locations.find((location) => location.id === locationId)?.name ??
    locationId
  )
}

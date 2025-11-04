export async function loadGeo(path: string) {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`Failed to load ${path}`)
  return r.json()
}

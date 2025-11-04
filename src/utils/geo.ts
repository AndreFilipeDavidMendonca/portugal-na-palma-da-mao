export function getDistrictKeyFromFeature(f: any) {
  const p = f?.properties || {}
  return (p.gn_name || p.name || p.NAME_1 || p.NAME || p.id || '').toString().toLowerCase()
}


export async function loadGeo(url: string){
  const res = await fetch(url)
  if(!res.ok) throw new Error('Falha a carregar ' + url)
  return res.json()
}

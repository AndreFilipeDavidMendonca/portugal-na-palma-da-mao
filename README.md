# Portugal na palma da mão — protótipo (React + Vite + TS)

## Scripts
- `npm install`
- `npm run dev` → http://localhost:5173

## O que já faz
- Mapa de Portugal (OpenStreetMap, React-Leaflet)
- Retângulo clicável do **Distrito de Lisboa** → navega para `/district/lisboa` e faz zoom
- **Castelo de São Jorge** com marcador e popup

## Onde editar
- `src/features/map/PortugalMap.tsx` → elementos do mapa geral
- `src/features/map/LisbonDistrictLayer.tsx` → vista do distrito
- `src/config/app.config.ts` → flags e defaults
- `src/pages/Home.tsx` e `src/pages/District.tsx` → páginas

> Nota: os limites do distrito são uma aproximação (retângulo). Podemos trocar por polígonos reais num passo seguinte.

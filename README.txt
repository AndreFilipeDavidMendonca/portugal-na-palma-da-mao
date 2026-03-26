Patch FE: share de POI para amigo a partir do PoiModal.

Inclui:
- botão Share ao lado de Favoritos no PoiHeader
- modal SharePoiToFriendModal.tsx
- startChat(friend.id) em background + sendChatMessage(POI_SHARE)
- não abre ChatModal após envio
- ChatModal preparado para renderizar mensagens POI_SHARE
- api.ts atualizado para payloads TEXT | POI_SHARE

Como aplicar no repo FE:
1) Na root do projeto:
   git apply share-poi-friend.patch

Se o patch tiver problema de path, aplica a partir da root certa do repo ou copia os ficheiros de /files.

Payload enviado ao backend:
{
  "type": "POI_SHARE",
  "poiId": 123,
  "poiName": "Castelo de Marvão",
  "poiImage": "https://..." // opcional
}

Nota:
- Tentei correr npm run build, mas o container não tem as type definitions resolvidas no ambiente atual:
  TS2688: Cannot find type definition file for 'google.maps'
  TS2688: Cannot find type definition file for 'node'
- Ou seja, o patch está preparado, mas a validação final no container ficou bloqueada por dependências/types do projeto.

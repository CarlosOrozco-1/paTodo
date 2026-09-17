# functions-legacy (Cloud Functions)

Este directorio conserva el código **legacy** del backend implementado con
**Firebase Cloud Functions** para PaTodo.

## ¿Qué era?

El backend lógico del proyecto (creación de usuarios, aceptación de ofertas,
completar trabajos, reseñas, rutas, notificaciones) estuvo implementado como
Cloud Functions de Firebase (TypeScript) en esta carpeta.

> Ojo: `firestore.rules` y `firestore.indexes.json` nacieron con ese diseño, pero
> las reglas se **reescribieron y endurecieron** para el diseño actual (autorización
> por Custom Claim `role` y por propiedad del recurso, con las transacciones en
> `api/`). Este código legacy **no** refleja las reglas vigentes.

## ¿Por qué se suspendió?

Las Cloud Functions de Firebase requieren el plan de pago **Blaze**
(pago por uso); el proyecto optó por no incurrir en ese costo y se migró el
backend a una **API REST Express** autohosteada.

## ¿A dónde se migró?

- La API está en [`api/`](../../api/): Express + TypeScript + `firebase-admin`,
  con los mismos endpoints transaccionales.
- La API se despliega en **Render** (plan gratuito):
  `https://patodo.onrender.com` (ver [`docs/api-emulador.md`](../api-emulador.md)
  para pruebas locales y la colección de Postman en `docs/postman/`).
- La autenticación, Firestore, FCM y las reglas de seguridad siguen en Firebase
  gestionado; solo la lógica de servidor cambió de Cloud Functions → API.

## Estado

- **No usar** este código para producción: está en desuso y se conserva solo
  como referencia histórica de la lógica que fue reimplementada en `api/`.
- No desplegar (`firebase deploy --only functions`) este directorio.
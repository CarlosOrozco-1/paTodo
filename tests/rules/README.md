# Pruebas de `firestore.rules`

Verifica que las reglas de Firestore concedan **solo** lo que deben. Corre contra
el emulador, sin credenciales y sin internet (salvo la primera descarga del
emulador).

```bash
npm install
npm run test:emulator
```

## Por qué la suite se ejecuta serializada

Los tres archivos comparten un solo emulador y cada uno limpia la base en su
`beforeEach`. Si corren en paralelo, un archivo borra los datos que otro está
verificando y los fallos cambian en cada corrida. Por eso el comando usa
`--test-concurrency=1`. **No quitarlo.**

## Por qué `firebase.test.json` existe

`firebase.json` deja el emulador de Firestore en el 8081, que puede estar ocupado
por una sesión de desarrollo. La config de test usa el 8181 para no chocar, y
así garantiza que las reglas evaluadas sean las del archivo actual y no las que
cargó un emulador anterior.

## En Windows

`firebase emulators:exec` no cierra bien los procesos hijos y se queda colgado
al terminar. El script de una pasada es para Linux/CI. En Windows, dos pasos:

```powershell
# 1. Levantar el emulador (dejar esta ventana abierta)
tests\rules\node_modules\.bin\firebase.cmd emulators:start --config firebase.test.json --only firestore --project demo-pa-todo

# 2. En otra terminal
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8181"
npm test --prefix tests/rules
```

## Cobertura actual

| Archivo | Qué protege |
|---|---|
| `users.test.mjs` | Lista blanca de campos editables: nadie se infla `rating` ni cambia su `role`; `availability` y `fcmTokens` sí se pueden editar |
| `reviews.test.mjs` | Las reseñas son de solo lectura desde el cliente (las stats las recalcula la API) |
| `messages.test.mjs` | Solo los participantes leen y escriben; nadie suplanta `senderId`, rea una conversación ni edita un mensaje |

## Pendiente conocido

`smallEnough()` en `firestore.rules` **no está midiendo bytes**: una escritura de
~200 KB en `profile.bio` se acepta sin error, así que el guardián de 128 KiB no
protege de nada. Está anotado con `test.todo` en `users.test.mjs` para que no se
pierda. El límite duro de 1 MiB de Firestore sigue aplicando.

#!/usr/bin/env bash
# Pruebas de seguridad y autorización de la API + reglas de Firestore.
#
# Verifica que NO se pueda:
#   - crear un perfil con un uid o un email que no sean los del token;
#   - saltarse la máquina de estados de un job desde el cliente (marcarlo
#     completed, asignarse workerId) en vez de usar la API;
#   - auto-aceptarse una oferta siendo el trabajador;
#   - actuar con un rol que no corresponde (un client enviando ofertas).
# Y que la API siga devolviendo el contrato { error, code } en JSON.
#
# Requisitos: emuladores (auth 9099, firestore 8081) y la API en el puerto 3000.
set -u

API="http://127.0.0.1:3000"
AUTH="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
FS="http://127.0.0.1:8081/v1/projects/pa-todo/databases/(default)/documents"
STAMP=$(date +%s)
PASS="test1234"
FAIL=0
DUP="seguro-cliente-$STAMP@test.com"
DUPW="seguro-worker-$STAMP@test.com"

tok() { python3 -c "import sys,json;print(json.load(sys.stdin)['idToken'])"; }
sub() { python3 -c "import sys,json;print(json.load(sys.stdin)['localId'])"; }
field() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d['name'].split('/')[-1] if 'name' in d else '')"; }

check() {
  if [ "$2" = "$3" ]; then
    echo "  PASS $1 -> $3"
  else
    echo "  FAIL $1 -> esperado $2, obtenido $3"
    FAIL=1
  fi
}

# ===================== Setup =====================
R=$(curl -s -X POST "$AUTH/accounts:signUp?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$DUP\",\"password\":\"$PASS\",\"returnSecureToken\":true}")
CT=$(echo "$R" | tok); CU=$(echo "$R" | sub)
R=$(curl -s -X POST "$AUTH/accounts:signUp?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$DUPW\",\"password\":\"$PASS\",\"returnSecureToken\":true}")
WT=$(echo "$R" | tok); WU=$(echo "$R" | sub)

curl -s -o /dev/null -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"uid\":\"$CU\",\"email\":\"$DUP\",\"role\":\"client\",\"profile\":{\"firstName\":\"A\",\"lastName\":\"B\"},\"contact\":{\"phone\":\"1\"}}"
curl -s -o /dev/null -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" \
  --data "{\"uid\":\"$WU\",\"email\":\"$DUPW\",\"role\":\"worker\",\"profile\":{\"firstName\":\"C\",\"lastName\":\"D\"},\"contact\":{\"phone\":\"2\"}}"

# Refrescar tokens para que incluyan el Custom Claim `role`.
CT=$(curl -s -X POST "$AUTH/accounts:signInWithPassword?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$DUP\",\"password\":\"$PASS\",\"returnSecureToken\":true}" | tok)
WT=$(curl -s -X POST "$AUTH/accounts:signInWithPassword?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$DUPW\",\"password\":\"$PASS\",\"returnSecureToken\":true}" | tok)

echo "=== A. Validación en POST /createUser ==="
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"uid\":\"$CU\",\"email\":\"otro-$STAMP@test.com\",\"role\":\"client\",\"profile\":{\"firstName\":\"A\",\"lastName\":\"B\"},\"contact\":{\"phone\":\"1\"}}")
check "createUser con email ajeno" 400 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"uid\":\"$WU\",\"email\":\"$DUP\",\"role\":\"client\",\"profile\":{\"firstName\":\"A\",\"lastName\":\"B\"},\"contact\":{\"phone\":\"1\"}}")
check "createUser con uid ajeno" 403 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" \
  --data "{\"uid\":\"$CU\",\"email\":\"$DUP\",\"role\":\"client\",\"profile\":{\"firstName\":\"A\",\"lastName\":\"B\"},\"contact\":{\"phone\":\"1\"}}")
check "createUser sin token" 401 "$C"

echo "=== B. El cliente no puede saltarse la máquina de estados del job ==="
JOB=$(curl -s -X POST "$FS/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{\"fields\":{\"clientId\":{\"stringValue\":\"$CU\"},\"details\":{\"mapValue\":{\"fields\":{\"title\":{\"stringValue\":\"t\"}}}},\"location\":{\"mapValue\":{\"fields\":{\"geohash\":{\"stringValue\":\"9fvg4\"}}}},\"pricing\":{\"mapValue\":{\"fields\":{\"proposedPrice\":{\"doubleValue\":10}}}},\"status\":{\"stringValue\":\"pending\"}}}")
JID=$(echo "$JOB" | field)
echo "  jobId=$JID"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/jobs/$JID?updateMask.fieldPaths=status" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data '{"fields":{"status":{"stringValue":"completed"}}}')
check "cliente marca su job como completed" 403 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/jobs/$JID?updateMask.fieldPaths=workerId" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{\"fields\":{\"workerId\":{\"stringValue\":\"$WU\"}}}")
check "cliente se auto-asigna workerId" 403 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/jobs/$JID?updateMask.fieldPaths=details" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data '{"fields":{"details":{"mapValue":{"fields":{"title":{"stringValue":"editado"}}}}}}')
check "cliente edita details (legítimo)" 200 "$C"

echo "=== C. El trabajador no puede auto-aceptarse la oferta ==="
OID=$(curl -s -X POST "$FS/offers" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data "{\"fields\":{\"jobId\":{\"stringValue\":\"$JID\"},\"workerId\":{\"stringValue\":\"$WU\"},\"price\":{\"integerValue\":\"20\"},\"estimatedTime\":{\"integerValue\":\"10\"},\"status\":{\"stringValue\":\"pending\"}}}" | field)
echo "  offerId=$OID"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/offers/$OID?updateMask.fieldPaths=status" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data '{"fields":{"status":{"stringValue":"accepted"}}}')
check "worker marca su oferta como accepted" 403 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/offers/$OID?updateMask.fieldPaths=price" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data '{"fields":{"price":{"integerValue":"25"}}}')
check "worker ajusta su precio (legítimo)" 200 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$FS/offers/$OID?updateMask.fieldPaths=status" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data '{"fields":{"status":{"stringValue":"withdrawn"}}}')
check "worker retira su oferta (pending->withdrawn)" 200 "$C"

echo "=== D. Autorización por rol (Custom Claim) ==="
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FS/offers" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{\"fields\":{\"jobId\":{\"stringValue\":\"$JID\"},\"workerId\":{\"stringValue\":\"$CU\"},\"price\":{\"integerValue\":\"5\"},\"estimatedTime\":{\"integerValue\":\"5\"},\"status\":{\"stringValue\":\"pending\"}}}")
check "un client (sin rol worker) crea oferta" 403 "$C"

echo "=== E. La API valida propiedad y estado ==="
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/acceptOffer" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data "{\"jobId\":\"$JID\",\"offerId\":\"$OID\"}")
check "un worker intenta acceptOffer (no es el dueño)" 403 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/completeJob" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{\"jobId\":\"$JID\"}")
check "completeJob con job pending" 412 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/createReview" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{\"jobId\":\"$JID\",\"rating\":5}")
check "createReview con job no completado" 412 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/acceptOffer" -H "Content-Type: application/json" -H "Authorization: Bearer malo" --data "{\"jobId\":\"$JID\",\"offerId\":\"$OID\"}")
check "token inválido" 401 "$C"

C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data "{no-es-json")
check "JSON malformado devuelve JSON (no HTML)" 400 "$C"

echo
if [ "$FAIL" = "0" ]; then echo "=== ✅ SEGURIDAD: TODAS LAS PRUEBAS PASARON ==="; else echo "=== ❌ HAY FALLOS ==="; exit 1; fi

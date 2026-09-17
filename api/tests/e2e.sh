#!/usr/bin/env bash
# Prueba E2E del flujo completo usando la API local + emuladores de Firebase.
# Requisitos: emuladores corriendo (auth 9099, firestore 8081) y la API en el puerto 3000.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="http://127.0.0.1:3000"
AUTH="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
FS="http://127.0.0.1:8081/v1/projects/pa-todo/databases/(default)/documents"
STAMP=$(date +%s)
EMAIL_C="clienteE2E-$STAMP@test.com"
EMAIL_W="trabajadorE2E-$STAMP@test.com"
PASS="test1234"
FAIL=0
NODE="env NODE_PATH=$ROOT/api/node_modules node $ROOT/api/tests/verify.js"

j() { python3 -c "import sys,json; print(json.load(sys.stdin)$1)"; }

signup_or_signin() {
  R=$(curl -s -X POST "$AUTH/accounts:signUp?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$1\",\"password\":\"$PASS\",\"returnSecureToken\":true}")
  if echo "$R" | grep -q '"idToken"'; then
    echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['idToken'],d['localId'])"
  else
    signin "$1"
  fi
}

# Vuelve a iniciar sesión para obtener un idToken con los Custom Claims al día.
signin() {
  R=$(curl -s -X POST "$AUTH/accounts:signInWithPassword?key=fake" -H "Content-Type: application/json" --data "{\"email\":\"$1\",\"password\":\"$PASS\",\"returnSecureToken\":true}")
  echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['idToken'],d['localId'])"
}

echo "=== 1/9 REGISTRO DE USUARIOS (Auth + POST /createUser) ==="
read CT CU <<<"$(signup_or_signin "$EMAIL_C")"
read WT WU <<<"$(signup_or_signin "$EMAIL_W")"
echo "clienteUid=$CU workerUid=$WU"
printf '{"uid":"%s","email":"%s","role":"client","profile":{"firstName":"Carlos","lastName":"Cliente"},"contact":{"phone":"+502 5555-0001"}}' "$CU" "$EMAIL_C" > /tmp/bc.json
printf '{"uid":"%s","email":"%s","role":"worker","profile":{"firstName":"Juan","lastName":"Worker"},"contact":{"phone":"+502 5555-0002"}}' "$WU" "$EMAIL_W" > /tmp/bw.json
CODE=$(curl -s -o /tmp/r1.json -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data @/tmp/bc.json)
if [ "$CODE" = "201" ]; then echo "  PASS createUser cliente (201)"; else echo "  FAIL createUser cliente: $CODE $(cat /tmp/r1.json)"; FAIL=1; fi
CODE=$(curl -s -o /tmp/r1.json -w "%{http_code}" -X POST "$API/createUser" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data @/tmp/bw.json)
if [ "$CODE" = "201" ]; then echo "  PASS createUser trabajador (201)"; else echo "  FAIL createUser trabajador: $CODE $(cat /tmp/r1.json)"; FAIL=1; fi

# /createUser asigna el rol como Custom Claim, pero viaja en el token: hay que
# refrescar la sesión para que las reglas de Firestore lo vean.
echo "  Refrescando tokens (Custom Claim role)..."
read CT CU <<<"$(signin "$EMAIL_C")"
read WT WU <<<"$(signin "$EMAIL_W")"

echo "=== 2/9 CREAR JOB (Firestore REST, token cliente) ==="
python3 - "$CU" > /tmp/job.json <<'PY'
import json,sys
cu=sys.argv[1]
print(json.dumps({"fields":{
  "clientId":{"stringValue":cu},
  "details":{"mapValue":{"fields":{
    "title":{"stringValue":"Cambio de llanta zona 10"},
    "description":{"stringValue":"Llanta ponchada"},
    "categoryId":{"stringValue":"cat-mecanica"},
    "skillIds":{"arrayValue":{"values":[{"stringValue":"sk-llantas"}]}}}}},
  "location":{"mapValue":{"fields":{
    "geopoint":{"mapValue":{"fields":{
      "latitude":{"doubleValue":14.6349},"longitude":{"doubleValue":-90.5069}}}},
    "geohash":{"stringValue":"9fvg4"},
    "address":{"stringValue":"Zona 10, Guatemala"}}}},
  "pricing":{"mapValue":{"fields":{
    "proposedPrice":{"doubleValue":35},
    "currency":{"stringValue":"GTQ"},
    "priceType":{"stringValue":"negotiable"}}}},
  "status":{"stringValue":"pending"}}}))
PY
R=$(curl -s -X POST "$FS/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data @/tmp/job.json)
JID=$(echo "$R" | j "['name'].split('/')[-1]")
echo "  jobId=$JID"
echo "$R" | grep -q '"error"' && { echo "  FAIL job: $R"; FAIL=1; } || echo "  PASS job creado"

echo "=== 3/9 CREAR OFERTA (Firestore REST, token trabajador) ==="
python3 - "$JID" "$WU" > /tmp/offer.json <<'PY'
import json,sys
jid,wu=sys.argv[1],sys.argv[2]
print(json.dumps({"fields":{
  "jobId":{"stringValue":jid},
  "workerId":{"stringValue":wu},
  "workerSnapshot":{"mapValue":{"fields":{
    "name":{"stringValue":"Juan Worker"},
    "rating":{"doubleValue":4.5},
    "completedJobs":{"integerValue":"8"}}}},
  "price":{"integerValue":"45"},
  "currency":{"stringValue":"GTQ"},
  "estimatedTime":{"integerValue":"30"},
  "message":{"stringValue":"Incluyo materiales"},
  "status":{"stringValue":"pending"}}}))
PY
R=$(curl -s -X POST "$FS/offers" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" --data @/tmp/offer.json)
OID=$(echo "$R" | j "['name'].split('/')[-1]")
echo "$R" | grep -q '"error"' && { echo "  FAIL oferta: $R"; FAIL=1; } || echo "  PASS oferta creada (offerId=$OID)"

echo "=== 4/9 ACEPTAR OFERTA (POST /acceptOffer) ==="
printf '{"jobId":"%s","offerId":"%s"}' "$JID" "$OID" > /tmp/accept.json
R=$(curl -s -X POST "$API/acceptOffer" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data @/tmp/accept.json)
echo "$R" | grep -q '"status":"accepted"' && echo "  PASS job accepted" || { echo "  FAIL acceptOffer: $(echo "$R" | head -c 300)"; FAIL=1; }

echo "=== 5/9 VERIFICAR CONVERSACIÓN (admin SDK) ==="
R=$($NODE conversation "$JID")
echo "$R"
echo "$R" | grep -q '"status":"active"' && echo "  PASS conversación activa" || { echo "  FAIL conversación"; FAIL=1; }

echo "=== 6/9 VERIFICAR NOTIFICACIONES (admin SDK) ==="
R=$($NODE notifications "$WU")
echo "$R"
echo "$R" | grep -q 'offer_accepted' && echo "  PASS notificación offer_accepted al worker" || { echo "  FAIL notificaciones worker"; FAIL=1; }

echo "=== 7/9 COMPLETAR JOB (POST /completeJob) ==="
printf '{"jobId":"%s"}' "$JID" > /tmp/comp.json
R=$(curl -s -X POST "$API/completeJob" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data @/tmp/comp.json)
echo "$R" | grep -q '"status":"completed"' && echo "  PASS job completado" || { echo "  FAIL completeJob: $(echo "$R" | head -c 300)"; FAIL=1; }

echo "=== 8/9 CREAR RESEÑA (POST /createReview) ==="
printf '{"jobId":"%s","rating":5,"comment":"Excelente servicio"}' "$JID" > /tmp/rev.json
R=$(curl -s -X POST "$API/createReview" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" --data @/tmp/rev.json)
echo "$R" | grep -q '"rating":5' && echo "  PASS reseña creada" || { echo "  FAIL createReview: $(echo "$R" | head -c 300)"; FAIL=1; }

echo "=== 9/9 VERIFICAR STATS WORKER + CONVERSACIÓN CERRADA (admin SDK) ==="
R=$($NODE user "$WU")
echo "$R"
echo "$R" | grep -q '"ratingCount":1' && echo "  PASS stats: ratingCount=1" || { echo "  FAIL ratingCount"; FAIL=1; }
echo "$R" | grep -q '"completedJobs":1' && echo "  PASS stats: completedJobs=1" || { echo "  FAIL completedJobs"; FAIL=1; }
echo "$R" | grep -q '"isOnline":false' && echo "  PASS availability.isOnline=false" || { echo "  FAIL isOnline"; FAIL=1; }
R=$($NODE conversation "$JID")
echo "$R"
echo "$R" | grep -q '"status":"closed"' && echo "  PASS conversación cerrada tras completeJob" || { echo "  FAIL conversación no cerrada"; FAIL=1; }

echo
if [ "$FAIL" = "0" ]; then echo "=== ✅ E2E COMPLETO: TODOS LOS PASOS PASARON ==="; else echo "=== ❌ E2E CON FALLOS ==="; exit 1; fi
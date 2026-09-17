process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp({ projectId: "pa-todo" });
const db = getFirestore();

async function convByJob(jobId) {
  const snap = await db.collection("conversations").where("jobId", "==", jobId).limit(5).get();
  const out = snap.docs.map((d) => ({ id: d.id, status: d.data().status, participants: d.data().participants }));
  console.log("CONVERSATIONS=" + JSON.stringify(out));
}

async function notifByUser(userId) {
  const snap = await db.collection("notifications").where("userId", "==", userId).limit(20).get();
  const out = snap.docs.map((d) => ({ type: d.data().type, title: d.data().title }));
  console.log("NOTIFICATIONS=" + JSON.stringify(out));
}

async function userDoc(uid) {
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) { console.log("USER=null"); return; }
  const d = doc.data();
  console.log("USER=" + JSON.stringify({
    stats: d.stats,
    availability: d.availability,
  }));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "conversation") return convByJob(args[0]);
  if (cmd === "notifications") return notifByUser(args[0]);
  if (cmd === "user") return userDoc(args[0]);
  console.log("usage: verify.js <conversation|notifications|user> <id>");
}

main().catch((e) => { console.error(e); process.exit(1); });
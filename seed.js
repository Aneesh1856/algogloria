const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, getDocs, doc, setDoc } = require("firebase/firestore");
require('dotenv').config({ path: './.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log("Using Project:", firebaseConfig.projectId);

async function seedData() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // 1. Seed Problem Statements
    console.log("Seeding Problems...");
    const problems = [
      { id: "PS1", title: "Real-time AI Traffic Management", description: "Optimize traffic flow using live camera feeds and RL agents." },
      { id: "PS2", title: "Decentralized Health Records", description: "Blockchain system for secure and patient-controlled EMR access." },
      { id: "PS3", title: "Smart Energy Grid", description: "IoT-based monitoring for local renewable energy distribution." }
    ];

    for (const ps of problems) {
      await setDoc(doc(db, "problems", ps.id), ps);
    }

    // 2. Create Admin & Evaluator accounts (Stubs in Firestore)
    console.log("Seeding Admin & Evaluator...");
    await setDoc(doc(db, "users", "ADMIN"), {
      enrollment_no: "ADMIN",
      name: "Super Admin",
      role: "admin",
      isPasswordSet: false,
      isInvited: false
    });

    await setDoc(doc(db, "users", "JUDGE01"), {
      enrollment_no: "JUDGE01",
      name: "Dr. Smith",
      role: "evaluator",
      isPasswordSet: false,
      isInvited: false
    });

    console.log("Seed complete!");
  } catch (e) {
    console.error("Error seeding:", e);
  }
}

seedData();

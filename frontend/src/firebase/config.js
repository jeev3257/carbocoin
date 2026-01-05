import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDrxHNcJec-7K8p75pnq3ED6b1FPZtOtO8",
  authDomain: "carbocoin-fb2a2.firebaseapp.com",
  projectId: "carbocoin-fb2a2",
  storageBucket: "carbocoin-fb2a2.firebasestorage.app",
  messagingSenderId: "54509970498",
  appId: "1:54509970498:web:997c81ed999975114a39db",
  measurementId: "G-B476C4KTN7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

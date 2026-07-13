import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// 1. 유저님의 새 프로젝트(my-dashboard-33bb6) 설정값으로 교체하는 영역
const firebaseConfig = {
  apiKey: "AIzaSyDcCdHUMrBeXSApdKymJ3fXmL6LsgMDSw4",
  authDomain: "my-dashboard-33bb6.firebaseapp.com",
  projectId: "my-dashboard-33bb6",
  storageBucket: "my-dashboard-33bb6.firebasestorage.app",
  messagingSenderId: "322579948921",
  appId: "1:322579948921:web:be0efc94d4c9b08a6cfba8",
  measurementId: "G-J18F7TZ0CT"
};

// 2. 삭제되면 안 되는 필수 초기화 및 내보내기 영역 (빌드 에러 해결 핵심 구간)
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
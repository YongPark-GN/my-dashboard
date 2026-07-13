import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth'; // 핵심 로직: Auth 모듈 로드

const firebaseConfig = {
  apiKey: "AIzaSyDcCdHUMrBeXSApdKymJ3fXmL6LsgMDSw4",
  authDomain: "my-dashboard-501915.firebaseapp.com",
  projectId: "my-dashboard-501915",
  storageBucket: "my-dashboard-501915.firebasestorage.app",
  messagingSenderId: "322579948921",
  appId: "1:322579948921:web:be0efc94d4c9b08a6cfba8",
  measurementId: "G-J18F7TZ0CT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // 핵심 로직: 인증 객체 외부 반환
export const googleProvider = new GoogleAuthProvider(); // 핵심 로직: 구글 로그인 프로바이더 생성
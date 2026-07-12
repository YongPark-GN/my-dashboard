import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // 핵심 로직: Firestore 데이터베이스 모듈 로드

// 유저가 제공한 고유 Firebase 웹 구성 키 세트 매핑
const firebaseConfig = {
  apiKey: "AIzaSyDcCdHUMrBeXSApdKymJ3fXmL6LsgMDSw4",
  authDomain: "my-dashboard-33bb6.firebaseapp.com",
  projectId: "my-dashboard-33bb6",
  storageBucket: "my-dashboard-33bb6.firebasestorage.app",
  messagingSenderId: "322579948921",
  appId: "1:322579948921:web:be0efc94d4c9b08a6cfba8",
  measurementId: "G-J18F7TZ0CT"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 핵심 로직: App.jsx에서 'db'라는 이름으로 호출할 수 있도록 Firestore 인스턴스 단독 내보내기
export const db = getFirestore(app);
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // 핵심 로직: Firestore 데이터베이스 모듈 로드

// 실제 발급받으신 고유 프로젝트 ID(my-dashboard-501915) 기준으로 매핑 수정
const firebaseConfig = {
  apiKey: "AIzaSyDcCdHUMrBeXSApdKymJ3fXmL6LsgMDSw4",
  authDomain: "my-dashboard-501915.firebaseapp.com",
  projectId: "my-dashboard-501915",
  storageBucket: "my-dashboard-501915.firebasestorage.app",
  messagingSenderId: "322579948921",
  appId: "1:322579948921:web:be0efc94d4c9b08a6cfba8",
  measurementId: "G-J18F7TZ0CT"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 핵심 로직: Firestore 인스턴스 단독 내보내기
export const db = getFirestore(app);
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

// 설정값은 .env.local 에서 주입 (예시는 .env.example 참고)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 2. 삭제되면 안 되는 필수 초기화 및 내보내기 영역 (빌드 에러 해결 핵심 구간)
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// dev 전용: 로컬 에뮬레이터에 붙인다 (`npm run dev:emu`).
// 가짜 uid 로 그냥 미리보기만 하면 Firestore 쓰기가 권한 거부돼서
// "저장 → 스냅샷이 되돌아옴" 경로를 전혀 검증할 수 없다. 그 경로에서만 나는
// 버그를 로그인 없이 잡으려면 에뮬레이터가 필요하다.
export const usingEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === '1';
if (usingEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
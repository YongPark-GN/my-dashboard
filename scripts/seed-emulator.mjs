// scripts/seed-emulator.mjs
// 에뮬레이터에 "이번 배포 직전 사용자" 상태의 layoutConfig 를 심는다.
// 위젯 16종을 추가하기 전 구조 — 위젯 6개짜리 페이지 두 장(회사/집).
//
//   node scripts/seed-emulator.mjs <uid>
//
// REST API 를 직접 쓴다. 에뮬레이터는 `Authorization: Bearer owner` 를 관리자
// 접근으로 취급하므로 보안 규칙을 건너뛰고 심을 수 있다.

const PROJECT = 'my-dashboard-33bb6';
const HOST = '127.0.0.1:8080';
const uid = process.argv[2];

if (!uid) {
  console.error('사용법: node scripts/seed-emulator.mjs <uid>');
  process.exit(1);
}

const OLD_ORDER = ['clock', 'weather', 'quote', 'calendar', 'memo', 'mindmap'];
const OLD_SIZES = {
  clock: { width: 380, height: 240 }, weather: { width: 320, height: 260 },
  quote: { width: 360, height: 240 }, calendar: { width: 720, height: 380 },
  memo: { width: 360, height: 320 }, mindmap: { width: 360, height: 260 }
};

// Firestore REST 의 값 표현으로 변환
const toValue = (v) => {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (v && typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { stringValue: String(v) };
};

const page = (id, name) => ({
  id, name,
  widgetOrder: [...OLD_ORDER],
  visibleWidgets: [...OLD_ORDER],
  widgetSizes: { ...OLD_SIZES }
});

const doc = { pages: [page('default', '회사'), page('p_home', '집')] };

const url = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/dashboard/layoutConfig`;
const res = await fetch(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, toValue(v)])) })
});

console.log(res.ok ? `seeded ${uid} (배포 직전 구조: 위젯 6개 × 페이지 2장)` : `실패 ${res.status}: ${await res.text()}`);

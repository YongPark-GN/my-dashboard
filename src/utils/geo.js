// utils/geo.js — 위치 관련 공용 헬퍼. 위치 기반 위젯(날씨·대기질·일출)이 함께 쓴다.

export const SEOUL = { lat: 37.5665, lon: 126.978, label: '서울 (기본 위치)' };

/** 브라우저 위치를 물어보고, 거부/실패하면 서울로 떨어진다. 항상 성공한다. */
export function getCoords({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ ...SEOUL, precise: false }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: '내 위치', precise: true }),
      () => resolve({ ...SEOUL, precise: false }),
      { timeout }
    );
  });
}

/** 좌표 → 한국어 지명. 키 불필요. 실패하면 null. */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`);
    if (!res.ok) return null;
    const d = await res.json();
    const local = d.locality || d.city;
    const region = d.principalSubdivision;
    if (local && region && !region.includes(local)) return `${local}, ${region}`;
    return local || region || null;
  } catch { return null; }
}

/** 위치 + 지명을 한 번에. 위젯들이 보통 이걸 쓴다. */
export async function getPlace() {
  const coords = await getCoords();
  if (!coords.precise) return coords;
  const name = await reverseGeocode(coords.lat, coords.lon);
  return { ...coords, label: name || coords.label };
}

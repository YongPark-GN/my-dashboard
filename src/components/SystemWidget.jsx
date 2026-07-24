// components/SystemWidget.jsx — 배터리·네트워크·화면 상태. 노트북에서 대시보드를 띄워둘 때 유용.
// Battery Status API 는 파이어폭스·사파리에 없다 → 없으면 그 칸만 숨긴다.
import { useState, useEffect } from 'react';
import { Battery, BatteryCharging, Wifi, WifiOff, Monitor } from 'lucide-react';
import { widgetRoot, panel } from '../styles/widgetUI';
import { WidgetHeader } from './widgetKit';

export default function SystemWidget() {
  const [battery, setBattery] = useState(null); // { level, charging } | null(미지원)
  const [online, setOnline] = useState(navigator.onLine);
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    let bat = null;
    const sync = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging });

    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        bat = b;
        sync();
        b.addEventListener('levelchange', sync);
        b.addEventListener('chargingchange', sync);
      }).catch(() => setBattery(null));
    }

    const onNet = () => setOnline(navigator.onLine);
    const onResize = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
      window.removeEventListener('resize', onResize);
      if (bat) { bat.removeEventListener('levelchange', sync); bat.removeEventListener('chargingchange', sync); }
    };
  }, []);

  const batteryColor = !battery ? 'var(--txt-dim)'
    : battery.charging ? '#34c759'
    : battery.level <= 20 ? 'var(--danger)'
    : battery.level <= 40 ? '#ff9500' : 'var(--txt)';

  return (
    <div style={widgetRoot}>
      <WidgetHeader title="시스템" sub={Intl.DateTimeFormat().resolvedOptions().timeZone} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', minHeight: 0 }}>
        {battery && (
          <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {battery.charging
              ? <BatteryCharging size={18} strokeWidth={1.6} style={{ color: batteryColor, flexShrink: 0 }} />
              : <Battery size={18} strokeWidth={1.6} style={{ color: batteryColor, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>배터리{battery.charging ? ' · 충전 중' : ''}</div>
              <div style={{ height: '5px', borderRadius: '3px', background: 'var(--chip-strong)', marginTop: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${battery.level}%`, height: '100%', background: batteryColor, transition: 'width 0.4s' }} />
              </div>
            </div>
            <span style={{ fontSize: '1rem', fontWeight: '600', color: batteryColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{battery.level}%</span>
          </div>
        )}

        <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {online
            ? <Wifi size={18} strokeWidth={1.6} style={{ color: '#34c759', flexShrink: 0 }} />
            : <WifiOff size={18} strokeWidth={1.6} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>네트워크</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{online ? '온라인' : '오프라인'}</div>
          </div>
        </div>

        <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Monitor size={18} strokeWidth={1.6} style={{ color: 'var(--txt-dim)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>창 크기</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{screen.w} × {screen.h}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

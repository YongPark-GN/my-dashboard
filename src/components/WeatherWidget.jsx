import React, { useState, useEffect } from 'react';

const WEATHER_API_KEY = "2cabd2173d9f6036bf418d61e79b48f8";

const getAqiStatus = (aqi) => {
  switch(aqi) {
    case 1: return { label: "좋음", color: "#34c759" }; 
    case 2: return { label: "보통", color: "#ffcc00" }; 
    case 3: return { label: "주의", color: "#ff9500" }; 
    case 4: return { label: "나쁨", color: "#ff3b30" }; 
    case 5: return { label: "위험", color: "#af52de" }; 
    default: return { label: "정보 없음", color: "#8e8e93" };
  }
};

export default function WeatherWidget() {
  const [weatherData, setWeatherData] = useState({ weather: null, pollution: null });
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const [weatherRes, pollutionRes] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`),
          fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}`)
        ]);
        setWeatherData({ weather: await weatherRes.json(), pollution: await pollutionRes.json() });
        setWeatherLoading(false);
      } catch (err) { console.error(err); }
    });
  }, []);

  return weatherLoading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.3)' }}>날씨 동기화 중...</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '2.8rem', fontWeight: '200' }}>{Math.round(weatherData.weather.main.temp)}°</div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{weatherData.weather.weather[0].description}</div>
        </div>
        <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '10px' }}>{weatherData.weather.name}</span>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>대기질</span>
          <span style={{ fontWeight: '600', color: getAqiStatus(weatherData.pollution.list[0].main.aqi).color }}>{getAqiStatus(weatherData.pollution.list[0].main.aqi).label}</span>
        </div>
      </div>
    </div>
  );
}
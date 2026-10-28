import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { getMapData, cityCoords } from './mockData';

const C = {
  purple: '#7700FF', purpleDark: '#5A00C2', purpleSoft: '#F3EBFF',
  blue: '#2D5BFF', orange: '#FF4F12', ink: '#101828',
  gray700: '#344054', gray500: '#667085', gray300: '#D0D5DD',
  gray100: '#F2F4F7', white: '#FFFFFF', bg: '#F7F7FB',
};

const cardStyle = {
  background: C.white, borderRadius: '16px',
  boxShadow: '0 1px 2px rgba(255, 255, 255, 0.06), 0 8px 24px rgba(255, 255, 255, 0.06)',
  padding: '24px',
};

function App() {
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);

  const [minRevenue, setMinRevenue] = useState(0);
  const [industry, setIndustry] = useState('Все');
  const [growthFilter, setGrowthFilter] = useState('Все');
  const [whiteSpots, setWhiteSpots] = useState([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map('map', { zoomControl: false }).setView([47.2313, 39.7233], 9);
      mapInstanceRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const style = document.createElement('style');
      style.innerHTML = `
        .leaflet-tile-pane { 
          filter: saturate(1.0) contrast(1.0); 
        }
      `;
      document.head.appendChild(style);

      setInterval(() => {
        document.querySelectorAll('.leaflet-tile').forEach(tile => {
          if (!tile.style.filter) {
            tile.style.filter = 'grayscale(0%) opacity(0.7) contrast(1.1)';
          }
        });
      }, 500);

      const hideAttribution = document.createElement('style');
      hideAttribution.innerHTML = '.leaflet-control-attribution { display: none !important; }';
      document.head.appendChild(hideAttribution);

      map.on('click', function(e) {
        map.setView(e.latlng, map.getZoom() + 2);
      });
    }

    const renderData = () => {
      const map = mapInstanceRef.current; 
      layersRef.current.forEach(layer => map.removeLayer(layer));
      layersRef.current = [];

      const allData = getMapData();
      const filteredData = allData.filter(c => {
        const matchesRevenue = c.revenue >= minRevenue;
        const matchesIndustry = industry === 'Все' || c.industry === industry;
        const matchesGrowth = growthFilter === 'Все' 
          || (growthFilter === 'Растущие' && c.growth > 0)
          || (growthFilter === 'Падающие' && c.growth <= 0);
        return matchesRevenue && matchesIndustry && matchesGrowth;
      });

      const heatPoints = filteredData.map(c => [c.lat, c.lng, 1.0]);
      const heatLayer = L.heatLayer(heatPoints, {
        radius: 65, blur: 25, minOpacity: 0.3,
        gradient: { 0.6: C.purple, 0.9: C.orange, 0.1: C.orange}
      });

      const markersGroup = L.layerGroup();
      filteredData.forEach(company => {
        const color = company.isOur ? C.purple : C.orange;
        const marker = L.circleMarker([company.lat, company.lng], {
          radius: 8, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
        }).bindPopup(`<b>${company.name}</b><br/>ИНН: ${company.inn}<br/>Город: ${company.city}<br/>Отрасль: ${company.industry}<br/>Выручка: ${(company.revenue / 1000000).toFixed(1)} млн ₽<br/>Динамика: <span style="color: ${company.growth > 0 ? 'green' : 'red'}">${company.growth > 0 ? '+' : ''}${company.growth}%</span><br/>Статус: ${company.isOur ? 'Действующий клиент' : 'Потенциальный клиент'}`);
        markersGroup.addLayer(marker);
      });

      if (map.getZoom() >= 12) {
        if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
        markersGroup.addTo(map);
      } else {
        if (map.hasLayer(markersGroup)) map.removeLayer(markersGroup);
        heatLayer.addTo(map);
      }
      layersRef.current.push(heatLayer, markersGroup);
    };

    renderData();
    mapInstanceRef.current.on('zoomend', renderData);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('zoomend', renderData);
      }
    };
  }, [minRevenue, industry, growthFilter]);

  const findWhiteSpots = () => {
    const zones = {};
    getMapData().forEach(c => {
      if (!zones[c.city]) zones[c.city] = { total: 0, our: 0 };
      zones[c.city].total += 1;
      if (c.isOur) zones[c.city].our += 1;
    });
    const foundSpots = Object.keys(zones).filter(city => {
      const z = zones[city];
      return z.total >= 2 && (z.our / z.total) < 0.3;
    });
    setWhiteSpots(foundSpots);
  };

  return (
    <div style={{ fontFamily: '"Segoe UI", Roboto, Arial, sans-serif', background: C.bg, minHeight: '100vh', paddingBottom: '40px' }}>
      
             <style>{`
          body {
          background-color: #F7F7FB; 
          margin: 0;
          padding: 0;
        }
        
        input, select {
          background-color: #FFFFFF;
          color: #101828;
          border: 1.5px solid #D0D5DD; /* Светлая рамка в покое */
          border-radius: 8px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        
        input:hover, select:hover, input:focus, select:focus {
          border-color: #7700FF !important;
          box-shadow: 0 0 0 4px rgba(119, 0, 255, 0.15);
        }

          background-color: #FFFFFF;
          color: #101828;
          border: 2px solid transparent;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }

        button:hover {
          border-color: #7700FF !important;
        }

        button:focus {
          outline: none;
          box-shadow: none;
        }

        button[style*="background: rgb(255, 79, 18)"] {
          background-color: #FF4F12 !important;
          color: #FFFFFF;
          border: 2px solid transparent;
        }
          
        button[style*="background: rgb(255, 79, 18)"]:hover {
          border-color: #FF4F12 !important;
          box-shadow: 0 0 8px rgba(255, 79, 18, 0.6);
        }
      `}</style>

      <header style={{ background: `linear-gradient(110deg, #3B0A8C 0%, ${C.purple} 55%, ${C.blue} 100%)`, padding: '20px 32px', color: C.white }}>
        <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Радар присутствия</h1>
        <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>Ростелеком · Хакатон 2026</p>
      </header>

         <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '28px 32px' }}>
        
        {/* Фильтры */}
        <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: C.gray700 }}>
              Выручка от (млн ₽):
              <input type="number" min="0" value={minRevenue / 1000000} 
                onChange={(e) => setMinRevenue(Math.max(0, Number(e.target.value)) * 1000000)} 
                onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                style={{ marginLeft: '8px', padding: '8px 12px', border: `1px solid ${C.gray300}`, borderRadius: '8px', width: '80px' }} />
            </label>
            <label style={{ fontSize: '14px', fontWeight: '600', color: C.gray700 }}>
              Отрасль:
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ marginLeft: '8px', padding: '8px 12px', border: `1px solid ${C.gray300}`, borderRadius: '8px' }}>
                <option value="Все">Все</option>
                <option value="АПК">АПК</option>
                <option value="Производство">Производство</option>
                <option value="Строительство">Строительство</option>
                <option value="Торговля">Торговля</option>
                <option value="Недвижимость">Недвижимость</option>
                <option value="Транспорт">Транспорт</option>
                <option value="IT">IT</option>
              </select>
            </label>
            <label style={{ fontSize: '14px', fontWeight: '600', color: C.gray700 }}>
              Динамика:
              <select value={growthFilter} onChange={(e) => setGrowthFilter(e.target.value)} style={{ marginLeft: '8px', padding: '8px 12px', border: `1px solid ${C.gray300}`, borderRadius: '8px' }}>
                <option value="Все">Все</option>
                <option value="Растущие">Растущие</option>
                <option value="Падающие">Падающие</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '14px', whiteSpace: 'nowrap' }}>
              <span style={{ width: '12px', height: '12px', background: C.purple, borderRadius: '50%', marginRight: '6px' }}></span> Действующий клиент
            </span>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '14px', whiteSpace: 'nowrap' }}>
              <span style={{ width: '12px', height: '12px', background: C.orange, borderRadius: '50%', marginRight: '6px' }}></span> Потенциальный клиент
            </span>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '12px', marginBottom: '24px' }}>
          <div id="map" style={{ height: '600px', width: '100%', borderRadius: '8px', zIndex: 0 }}></div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: C.ink }}>Геоаналитика</h3>
          <button onClick={findWhiteSpots} style={{ background: C.orange, color: C.white, border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', marginBottom: '16px' }}>
            Найти «Белые пятна»
          </button>
          
          {whiteSpots.length > 0 && (
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: C.gray700, marginBottom: '12px' }}>Найденные зоны:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {whiteSpots.map(city => (
                  <button key={city} onClick={() => mapInstanceRef.current.setView(cityCoords[city] || [47.2313, 39.7233], 12)}
                    style={{ background: C.purpleSoft, color: C.purple, border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                    {city} 📍
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;
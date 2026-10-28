import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet/dist/leaflet.css';

const hideAttribution = document.createElement('style');
hideAttribution.innerHTML = '.leaflet-control-attribution { display: none !important; }';
document.head.appendChild(hideAttribution); 

import 'leaflet.heat';
import { getMapData, cityCoords } from './mockData';


// Мок-данные по Ростовской области (наши и не наши)

function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]); // Сюда сохраним слои, чтобы фильтровать
  
  // Состояния для фильтров
  const [minRevenue, setMinRevenue] = useState(0);
  const [industry, setIndustry] = useState('Все');
  const [growthFilter, setGrowthFilter] = useState('Все');
  const [whiteSpots, setWhiteSpots] = useState([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      // Инициализация карты (центр - Ростов-на-Дону)
      const map = L.map('map').setView([47.2313, 39.7233], 9);
      map.on('click', function(e) {
        map.setView(e.latlng, map.getZoom() + 2); // Приближаемся на 2 шага
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap Russia'
}).addTo(map);
    }

    // Функция отрисовки данных с учетом фильтров
    const renderData = () => {
      const map = mapInstanceRef.current;
      
      // Очищаем старые слои
      layersRef.current.forEach(layer => map.removeLayer(layer));
      layersRef.current = [];

      // Фильтруем данные
            // Фильтруем данные (учитываем выручку, отрасль и динамику роста)
            // Получаем данные с координатами
      const allData = getMapData();

      // Фильтруем данные
      const filteredData = allData.filter(c => {
        const matchesRevenue = c.revenue >= minRevenue;
        const matchesIndustry = industry === 'Все' || c.industry === industry;
        const matchesGrowth = growthFilter === 'Все' 
          || (growthFilter === 'Растущие' && c.growth > 0)
          || (growthFilter === 'Падающие' && c.growth <= 0);
          
        return matchesRevenue && matchesIndustry && matchesGrowth;
      });

      // 1. Тепловая карта (только если зум < 11, чтобы на приближении не мешала)
      const heatPoints = filteredData.map(c => [c.lat, c.lng, 100.0]);
      const heatLayer = L.heatLayer(heatPoints, {
        radius: 50,
        blur: 20,
        gradient: {0.4: '#1900FF', 0.7: '#7722FF', 1.0: '#FF4F12'} // Брендовые цвета
      });

      // 2. Слой точек (маркеров)
      const markersGroup = L.layerGroup();
      filteredData.forEach(company => {
        const color = company.isOur ? '#7722FF' : '#FF4F12'; // Фиолетовый (наши) / Оранжевый (не наши)
        const marker = L.circleMarker([company.lat, company.lng], {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
                }).bindPopup(`<b>${company.name}</b><br/>
          ИНН: ${company.inn}<br/>
          Город: ${company.city}<br/>
          Отрасль: ${company.industry}<br/>
          Выручка: ${(company.revenue / 1000000).toFixed(1)} млн ₽<br/>
          Динамика: <span style="color: ${company.growth > 0 ? 'green' : 'red'}">${company.growth > 0 ? '+' : ''}${company.growth}%</span><br/>
          Статус: ${company.isOur ? 'Наш клиент' : 'Потенциальный'}`);
        
        markersGroup.addLayer(marker);
      });

      // Логика: если зум большой (приблизились) - показываем точки и убираем heatmap. Если маленький - наоборот.
      const currentZoom = map.getZoom();
      if (currentZoom >= 11) {
        if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
        markersGroup.addTo(map);
      } else {
        if (map.hasLayer(markersGroup)) map.removeLayer(markersGroup);
        heatLayer.addTo(map);
      }

      layersRef.current.push(heatLayer, markersGroup);
    };

    renderData();

    // Перерисовка при изменении зума
    mapInstanceRef.current.on('zoomend', renderData);

    // Очистка при размонтировании
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('zoomend', renderData);
      }
    };
  }, [minRevenue, industry, growthFilter]); // Эффект перезапускается при изменении фильтров

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#1900FF' }}>Радар присутствия</h1>
      
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'center', // Центрируем по горизонтали
        alignItems: 'center',     // Выравниваем по вертикали
        gap: '15px',              // Расстояние между фильтрами (было 20px)
        flexWrap: 'wrap'          // Чтобы на узких экранах не ломалось
      }}>
                <label>
          Выручка от (млн ₽): 
          <input 
            type="number" 
            min="0" 
            value={minRevenue / 1000000} 
            onChange={(e) => setMinRevenue(Math.max(0, Number(e.target.value)) * 1000000)} 
            onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
            style={{ marginLeft: '5px' }} 
          />
        </label>

        <label>
          Отрасль: 
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ marginLeft: '5px' }}>
            <option value="Все">Все</option>
            <option value="АПК">АПК</option>
            <option value="Производство">Производство</option>
            <option value="Строительство">Строительство</option>
            <option value="Торговля">Торговля</option>
            <option value="Недвижимость">Недвижимость</option>
            <option value="Транспорт">Транспорт</option>
            <option value="IT">IT</option>
            <option value="Добыча">Добыча</option>
            <option value="Ремонт машин">Ремонт машин</option>
            <option value="Безопасность">Безопасность</option>
            <option value="Химпром">Химпром</option>
            <option value="Аренда авто">Аренда авто</option>
          </select>
        </label>

        <label>
          Динамика: 
          <select value={growthFilter} onChange={(e) => setGrowthFilter(e.target.value)} style={{ marginLeft: '5px' }}>
            <option value="Все">Все</option>
            <option value="Растущие">Растущие</option>
            <option value="Падающие">Падающие</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '10px', fontSize: '14px' }}>
          <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}><span style={{ width: '12px', height: '12px', background: '#7722FF', borderRadius: '50%', marginRight: '5px' }}></span> Наши</span>
          <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}><span style={{ width: '12px', height: '12px', background: '#FF4F12', borderRadius: '50%', marginRight: '5px' }}></span> Не наши</span>
        </div>
      </div>
      
            {/* === БЛОК АНАЛИТИКИ И БЕЛЫХ ПЯТЕН === */}
      <div style={{ marginBottom: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#1900FF', fontSize: '18px' }}>Геоаналитика</h3>
                    <button 
            onClick={() => {
              const zones = {};
              getMapData().forEach(c => {
                if (!zones[c.city]) zones[c.city] = { total: 0, our: 0 };
                zones[c.city].total += 1;
                if (c.isOur) zones[c.city].our += 1;
              });

              // Ищем города, где есть бизнес, но наших клиентов меньше 20%
              const foundSpots = Object.keys(zones).filter(city => {
                const z = zones[city];
                return z.total >= 2 && (z.our / z.total) < 0.5; 
              });

              setWhiteSpots(foundSpots); // Сохраняем в стейт для отображения
            }}
            style={{ 
              background: '#FF4F12', color: 'white', border: 'none', padding: '8px 15px', 
              borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            Найти «Белые пятна»
          </button>
        </div>
        
                {/* Вывод списка белых пятен */}
        {whiteSpots.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Найденные зоны:</span>
            {whiteSpots.map(city => (
              <button 
                key={city}
                onClick={() => {
                  const coords = cityCoords[city] || [47.2313, 39.7233];
                  mapInstanceRef.current.setView(coords, 12); // Перелет на карте
                }}
                style={{ background: '#7722FF', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
              >
                {city} 📍
              </button>
            ))}
          </div>
        )}

        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          * Нажмите кнопку, чтобы автоматически найти районы, где есть бизнес, но нет наших клиентов.
        </p>
      </div>
      {/* ===================================== */}

      {/* Контейнер карты */}
      <div id="map" style={{ height: '600px', width: '100%', borderRadius: '12px', border: '1px solid #ddd' }}></div>
    </div>
  );
}

export default App;
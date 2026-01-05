
import React, { useEffect, useRef, useState } from 'react';
import { Customer } from '../types';
import { Maximize2, Minimize2, Layers, Map as MapIcon, Globe, Palette, Users } from 'lucide-react';

interface CustomerMapProps {
  customers: Customer[];
}

type MapLayer = 'standard' | 'satellite' | 'grayscale';

const TILE_LAYERS: Record<MapLayer, { url: string; attr: string }> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
  },
  grayscale: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

const getApproxCoordinates = (city: string) => {
  const coords: Record<string, [number, number]> = {
    '台北市': [25.0330, 121.5654], '新北市': [25.0117, 121.4658], '桃園市': [24.9936, 121.3010],
    '台中市': [24.1477, 120.6736], '台南市': [22.9997, 120.2270], '高雄市': [22.6273, 120.3014],
    '新竹市': [24.8138, 120.9675], '新竹縣': [24.8387, 121.0177], '苗栗縣': [24.5601, 120.8210],
    '彰化縣': [24.0518, 120.5161], '南投縣': [23.9101, 120.6846], '雲林縣': [23.7092, 120.4313],
    '嘉義市': [23.4801, 120.4491], '嘉義縣': [23.4518, 120.2559], '屏東縣': [22.6659, 120.4861],
    '宜蘭縣': [24.7021, 121.7377], '花蓮縣': [23.9871, 121.6016], '台東縣': [22.7583, 121.1444],
    '澎湖縣': [23.5711, 119.5793], '金門縣': [24.4361, 118.3186], '連江縣': [26.1558, 119.9519],
  };
  return coords[city] || [23.6978, 120.9605];
};

const CustomerMap: React.FC<CustomerMapProps> = ({ customers }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const clusterGroup = useRef<any>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('grayscale');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || mapInstance.current) return;

    // 初始化地圖實例
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: true
    }).setView([23.8, 121.0], 7);
    
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

    const config = TILE_LAYERS[activeLayer];
    tileLayerLayer(config);

    if (L.markerClusterGroup) {
      clusterGroup.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let color = 'bg-blue-600';
          if (count > 50) color = 'bg-red-600';
          else if (count > 10) color = 'bg-amber-500';

          return L.divIcon({
            html: `<div class="${color} w-10 h-10 text-white rounded-full flex items-center justify-center font-black shadow-xl border-4 border-white/80 backdrop-blur-sm transition-all hover:scale-110"><span>${count}</span></div>`,
            className: 'custom-marker-cluster-icon',
            iconSize: L.point(40, 40)
          });
        }
      });
      mapInstance.current.addLayer(clusterGroup.current);
    }

    // 重點：監聽容器大小變化，解決 Tab 切換或匯入後顯示不全的問題
    resizeObserver.current = new ResizeObserver(() => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    });
    if (containerRef.current) {
      resizeObserver.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver.current) resizeObserver.current.disconnect();
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const tileLayerLayer = (config: any) => {
    const L = (window as any).L;
    if (tileLayerRef.current) mapInstance.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(config.url, { attribution: config.attr }).addTo(mapInstance.current);
  };

  useEffect(() => {
    if (mapInstance.current) tileLayerLayer(TILE_LAYERS[activeLayer]);
  }, [activeLayer]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !clusterGroup.current) return;

    clusterGroup.current.clearLayers();
    const bounds = L.latLngBounds([]);

    customers.forEach((customer) => {
      const baseCoords = customer.lat && customer.lng ? [customer.lat, customer.lng] : getApproxCoordinates(customer.city);
      const finalCoords: [number, number] = customer.lat && customer.lng ? (baseCoords as [number, number]) : [baseCoords[0] + (Math.random() - 0.5) * 0.05, baseCoords[1] + (Math.random() - 0.5) * 0.05];

      const marker = L.marker(finalCoords).bindPopup(`
        <div class="p-2 min-w-[180px]">
          <h4 class="font-black text-blue-700 text-base mb-1">${customer.name}</h4>
          <p class="text-xs text-slate-500 font-medium mb-3">${customer.address}</p>
          ${customer.mapUrl ? `<a href="${customer.mapUrl}" target="_blank" class="block w-full text-center bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black hover:bg-blue-600">導航連結</a>` : ''}
        </div>
      `);
      clusterGroup.current.addLayer(marker);
      bounds.extend(finalCoords);
    });

    if (customers.length > 0) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [customers]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-500 ${isFullscreen ? 'h-screen w-screen z-[1000] fixed top-0 left-0 rounded-none' : 'h-[650px] relative'}`}
    >
      <div className="p-5 border-b bg-white flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg"><MapIcon size={20} /></div>
          <div><h3 className="font-black text-slate-800 text-lg leading-none">分佈概覽</h3><p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">Dynamic Spatial Analysis</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLayerMenu(!showLayerMenu)} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all"><Layers size={18} /></button>
          <button onClick={toggleFullscreen} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 transition-all">{isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
      </div>

      <div ref={mapRef} className="flex-1 z-0" />

      {showLayerMenu && (
        <div className="absolute top-20 right-5 z-20 bg-white p-2 rounded-3xl shadow-2xl border border-slate-100 w-48 animate-in fade-in slide-in-from-top-2">
          {(['grayscale', 'standard', 'satellite'] as MapLayer[]).map(l => (
            <button key={l} onClick={() => { setActiveLayer(l); setShowLayerMenu(false); }} className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-black transition-colors ${activeLayer === l ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              {l === 'grayscale' ? '極簡灰階' : l === 'standard' ? '標準地圖' : '高清衛星'}
            </button>
          ))}
        </div>
      )}

      <div className="absolute bottom-8 left-8 z-10 bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-white/50 shadow-xl pointer-events-none">
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[10px] font-black text-slate-600">1-10 筆</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-[10px] font-black text-slate-600">11-50 筆</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600"></div><span className="text-[10px] font-black text-slate-600">50+ 筆</span></div>
        </div>
      </div>
    </div>
  );
};

export default CustomerMap;

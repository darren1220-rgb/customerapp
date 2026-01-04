
import React, { useEffect, useRef, useState } from 'react';
import { Customer } from '../types';
import { Maximize2, Minimize2, Layers, Map as MapIcon, Globe, Palette } from 'lucide-react';

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
    '台北市': [25.0330, 121.5654],
    '新北市': [25.0117, 121.4658],
    '桃園市': [24.9936, 121.3010],
    '台中市': [24.1477, 120.6736],
    '台南市': [22.9997, 120.2270],
    '高雄市': [22.6273, 120.3014],
    '新竹市': [24.8138, 120.9675],
    '新竹縣': [24.8387, 121.0177],
    '苗栗縣': [24.5601, 120.8210],
    '彰化縣': [24.0518, 120.5161],
    '南投縣': [23.9101, 120.6846],
    '雲林縣': [23.7092, 120.4313],
    '嘉義市': [23.4801, 120.4491],
    '嘉義縣': [23.4518, 120.2559],
    '屏東縣': [22.6659, 120.4861],
    '宜蘭縣': [24.7021, 121.7377],
    '花蓮縣': [23.9871, 121.6016],
    '台東縣': [22.7583, 121.1444],
    '澎湖縣': [23.5711, 119.5793],
    '金門縣': [24.4361, 118.3186],
    '連江縣': [26.1558, 119.9519],
  };
  return coords[city] || [23.6978, 120.9605];
};

const CustomerMap: React.FC<CustomerMapProps> = ({ customers }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const clusterGroup = useRef<any>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('grayscale');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (mapInstance.current) {
        setTimeout(() => mapInstance.current.invalidateSize(), 300);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update Tile Layer when activeLayer changes
  useEffect(() => {
    if (mapInstance.current && (window as any).L) {
      const L = (window as any).L;
      if (tileLayerRef.current) {
        mapInstance.current.removeLayer(tileLayerRef.current);
      }
      const config = TILE_LAYERS[activeLayer];
      tileLayerRef.current = L.tileLayer(config.url, { attribution: config.attr }).addTo(mapInstance.current);
    }
  }, [activeLayer]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    if (mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([23.8, 121.0], 7);
      
      const config = TILE_LAYERS[activeLayer];
      tileLayerRef.current = L.tileLayer(config.url, { attribution: config.attr }).addTo(mapInstance.current);

      if (L.markerClusterGroup) {
        clusterGroup.current = L.markerClusterGroup({
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          spiderfyOnMaxZoom: true,
          chunkedLoading: true,
          polygonOptions: {
            fillColor: '#3b82f6',
            color: '#3b82f6',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.1
          }
        });
        mapInstance.current.addLayer(clusterGroup.current);
      }
    }

    if (clusterGroup.current && mapInstance.current) {
      clusterGroup.current.clearLayers();
      const bounds = L.latLngBounds([]);

      customers.forEach((customer) => {
        const coords: [number, number] = customer.lat && customer.lng 
          ? [customer.lat, customer.lng] 
          : getApproxCoordinates(customer.city);
        
        const finalCoords: [number, number] = customer.lat && customer.lng 
          ? coords 
          : [coords[0] + (Math.random() - 0.5) * 0.05, coords[1] + (Math.random() - 0.5) * 0.05];

        const marker = L.marker(finalCoords).bindPopup(`
          <div class="p-2 min-w-[150px] font-sans">
            <div class="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">${customer.id}</div>
            <h4 class="font-bold text-blue-700 text-base mb-1">${customer.name}</h4>
            <p class="text-sm text-gray-600 mb-2 leading-tight">${customer.address}</p>
            ${customer.mapUrl ? `<a href="${customer.mapUrl}" target="_blank" class="block text-center bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">在 Google Maps 開啟</a>` : ''}
          </div>
        `);
        
        clusterGroup.current.addLayer(marker);
        bounds.extend(finalCoords);
      });

      if (customers.length > 0 && mapInstance.current) {
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [customers]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${isFullscreen ? 'h-screen w-screen z-[1000] fixed top-0 left-0 rounded-none' : 'h-[600px] relative'}`}
    >
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <MapIcon size={18} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 leading-none">客戶地理分佈分析</h3>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Spatial Distribution</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Layer Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className={`p-2 rounded-lg border flex items-center gap-2 text-sm font-semibold transition-all ${showLayerMenu ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Layers size={18} />
              <span className="hidden sm:inline">底圖切換</span>
            </button>
            
            {showLayerMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLayerMenu(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <button 
                    onClick={() => { setActiveLayer('grayscale'); setShowLayerMenu(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeLayer === 'grayscale' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-600'}`}
                  >
                    <Palette size={16} /> 簡潔灰階 (最清晰)
                  </button>
                  <button 
                    onClick={() => { setActiveLayer('standard'); setShowLayerMenu(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeLayer === 'standard' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-600'}`}
                  >
                    <MapIcon size={16} /> 標準地圖
                  </button>
                  <button 
                    onClick={() => { setActiveLayer('satellite'); setShowLayerMenu(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeLayer === 'satellite' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-600'}`}
                  >
                    <Globe size={16} /> 衛星影像
                  </button>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center gap-2 text-sm font-semibold"
            title={isFullscreen ? "退出全螢幕" : "全螢幕顯示"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span className="hidden sm:inline">{isFullscreen ? "退出" : "全螢幕"}</span>
          </button>
        </div>
      </div>

      <div ref={mapRef} className="flex-1 bg-slate-100 relative z-0" />
      
      {/* Legend overlays */}
      <div className="absolute bottom-6 left-6 z-10 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-gray-200 shadow-lg flex flex-col gap-2 pointer-events-none">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-1">密度指標</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#B5E28C] border border-[#6ECC39]"></span>
          <span className="text-[11px] font-bold text-gray-600">低密度</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#F1D357] border border-[#F0C20C]"></span>
          <span className="text-[11px] font-bold text-gray-600">中密度</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FD9C73] border border-[#F18017]"></span>
          <span className="text-[11px] font-bold text-gray-600">高密度</span>
        </div>
      </div>

      {!isFullscreen && (
        <div className="px-4 py-2 bg-slate-900 text-white text-[10px] flex justify-between items-center tracking-wide">
          <span className="opacity-70 font-medium">使用提示：灰階模式下數量標示最為顯眼</span>
          <span className="font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            動態同步中
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomerMap;

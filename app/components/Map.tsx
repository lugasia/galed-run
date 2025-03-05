'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Point, Team } from '../types';

// Fix for Leaflet marker icons in Next.js
const icon = L.icon({
  iconUrl: '/images/marker-icon.png',
  iconRetinaUrl: '/images/marker-icon-2x.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  points: Point[];
  teams?: Team[];
  onPointClick?: (point: Point) => void;
  isEditable?: boolean;
}

const MapComponent = ({ points, teams, onPointClick, isEditable = false }: MapProps) => {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    // Download marker icons
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);

  const center: [number, number] = [32.5587, 35.0767]; // Default center (first point)

  return (
    <div className="w-full h-[600px] relative">
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {points.map((point) => (
          <Marker
            key={point._id}
            position={point.coordinates}
            icon={icon}
            eventHandlers={{
              click: () => onPointClick && onPointClick(point),
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold">{point.name}</h3>
                <p className="text-sm">קוד: {point.code}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {teams?.map((team) => (
          team.currentLocation && (
            <Marker
              key={team._id}
              position={team.currentLocation.coordinates}
              icon={L.divIcon({
                className: 'bg-blue-500 rounded-full w-4 h-4 border-2 border-white',
                iconSize: [16, 16],
              })}
            >
              <Popup>
                <div>
                  <h3 className="font-bold">{team.name}</h3>
                  <p className="text-sm">
                    עדכון אחרון: {new Date(team.currentLocation.timestamp).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent; 
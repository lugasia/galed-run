'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import type { Point, Team } from '../types';
import dynamic from 'next/dynamic';

// Create custom icon for points
const pointIcon = L.icon({
  iconUrl: '/images/marker-icon.png',
  iconRetinaUrl: '/images/marker-icon-2x.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Array of colors for teams
const teamColors = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEEAD', // Yellow
  '#D4A5A5', // Pink
  '#9B59B6', // Purple
  '#3498DB', // Light Blue
  '#E67E22', // Orange
  '#2ECC71', // Emerald
];

interface MapProps {
  points: Point[];
  teams?: Team[];
  center: [number, number];
  zoom: number;
}

const MapComponent = ({ points, teams = [], center, zoom }: MapProps) => {
  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {points.map((point) => (
          point.location && (
            <Marker
              key={point._id}
              position={point.location}
              icon={pointIcon}
            >
              <Popup>
                <div>
                  <h3 className="font-bold">{point.name}</h3>
                  <p className="text-sm">קוד: {point.code}</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {teams.map((team, index) => (
          team.currentLocation?.coordinates && (
            <CircleMarker
              key={team._id}
              center={team.currentLocation.coordinates}
              radius={8}
              fillColor={teamColors[index % teamColors.length]}
              color="#fff"
              weight={2}
              opacity={1}
              fillOpacity={0.8}
            >
              <Popup>
                <div>
                  <h3 className="font-bold">{team.name}</h3>
                  <p className="text-sm">מוביל: {team.leaderName}</p>
                  {team.currentLocation?.timestamp && (
                    <p className="text-xs text-gray-500">
                      עדכון אחרון: {new Date(team.currentLocation.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

const Map = dynamic(
  () => Promise.resolve(MapComponent),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }
);

export default Map;
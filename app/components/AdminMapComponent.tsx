'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Point, Team } from '../types';

// Fix for Leaflet marker icons in Next.js
const pointIcon = L.icon({
  iconUrl: '/images/marker-icon.png',
  iconRetinaUrl: '/images/marker-icon-2x.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const teamIcon = L.icon({
  iconUrl: '/images/player-marker.png',
  iconRetinaUrl: '/images/player-marker-2x.png',
  shadowUrl: '/images/marker-shadow.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface AdminMapProps {
  points: Point[];
  teams: Team[];
  onPointClick: (point: Point) => void;
  isEditable: boolean;
}

// Validate coordinates
function isValidLatLng(location: any): boolean {
  if (!Array.isArray(location)) return false;
  if (location.length !== 2) return false;
  const [lat, lng] = location;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function MapContent({ points, teams, onPointClick, isEditable }: AdminMapProps) {
  const map = useMap();

  useEffect(() => {
    // Fix map container size issue
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  // Debug log
  useEffect(() => {
    console.log('Points:', points);
    console.log('Teams:', teams);
  }, [points, teams]);

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Render points */}
      {points.filter(point => point && point.location && isValidLatLng(point.location)).map((point) => (
        <Marker
          key={point._id}
          position={point.location}
          icon={pointIcon}
          eventHandlers={{
            click: () => onPointClick(point),
          }}
        >
          <Popup>
            <div className="text-right">
              <h3 className="font-bold">{point.name}</h3>
              <p>קוד: {point.code}</p>
              {isEditable && (
                <button
                  onClick={() => onPointClick(point)}
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  ערוך
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Render team locations */}
      {teams.filter(team => team && team.currentLocation && isValidLatLng(team.currentLocation.coordinates)).map((team) => (
        <Marker
          key={team._id}
          position={team.currentLocation.coordinates}
          icon={teamIcon}
        >
          <Popup>
            <div className="text-right">
              <h3 className="font-bold">{team.name}</h3>
              <p className="text-sm text-gray-600">
                עדכון אחרון: {new Date(team.currentLocation.timestamp).toLocaleTimeString('he-IL')}
              </p>
              <p className="text-sm text-gray-600">
                נקודות שהושלמו: {team.visitedPoints.length} / {team.currentRoute?.points.length || 0}
              </p>
              {team.penaltyEndTime && new Date() < new Date(team.penaltyEndTime) && (
                <p className="text-sm text-red-600">
                  בעונשין עד: {new Date(team.penaltyEndTime).toLocaleTimeString('he-IL')}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const AdminMapComponent = ({ points = [], teams = [], onPointClick, isEditable }: AdminMapProps) => {
  const [isMapReady, setIsMapReady] = useState(false);

  // Debug log
  useEffect(() => {
    console.log('Initial points:', points);
    console.log('Initial teams:', teams);
  }, [points, teams]);

  useEffect(() => {
    // Fix Leaflet default icon issue
    if (typeof window !== 'undefined') {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/images/marker-icon-2x.png',
        iconUrl: '/images/marker-icon.png',
        shadowUrl: '/images/marker-shadow.png',
      });
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    
    link.onload = () => {
      setIsMapReady(true);
    };
    
    document.head.appendChild(link);

    return () => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached');
        return;
      }

      // Get WebSocket URL from environment variable or fallback to localhost
      // Note: Production should use wss:// protocol (secure WebSocket)
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      console.log(`AdminMap: Connecting to WebSocket at: ${wsUrl}`);
      console.log(`AdminMap: Current environment: ${process.env.NODE_ENV}`);
      
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('AdminMap: WebSocket connected successfully');
          reconnectAttempts = 0; // Reset attempts on successful connection
        };
        
        ws.onclose = (event) => {
          console.log(`AdminMap: WebSocket disconnected with code: ${event.code}, reason: ${event.reason || 'No reason provided'}`);
          console.log('AdminMap: Attempting to reconnect...');
          reconnectAttempts++;
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('AdminMap: WebSocket error:', error);
          console.log('AdminMap: Will attempt to reconnect on close');
          // The onclose handler will handle reconnection
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'LOCATION_UPDATE') {
              console.log('AdminMap: Location update received:', data);
            }
          } catch (error) {
            console.error('AdminMap: Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        console.error('AdminMap: Error creating WebSocket connection:', error);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        console.log('AdminMap: Closing WebSocket connection due to component unmount');
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  if (!isMapReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[32.557859, 35.076676]} // Default center at Kibbutz Gilad
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <MapContent
          points={points}
          teams={teams}
          onPointClick={onPointClick}
          isEditable={isEditable}
        />
      </MapContainer>
    </div>
  );
};

export default AdminMapComponent; 
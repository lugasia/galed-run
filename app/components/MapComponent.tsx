'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Point } from '../types';

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

const userIcon = L.divIcon({
  className: 'bg-blue-500 rounded-full border-2 border-white shadow-lg',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

interface MapProps {
  points: Point[];
  userLocation: [number, number];
  center: [number, number];
  zoom: number;
}

function LocationMarker({ userLocation }: { userLocation: [number, number] }) {
  const map = useMapEvents({
    locationfound: () => {
      map.setView(userLocation, map.getZoom());
    },
  });

  useEffect(() => {
    map.setView(userLocation, map.getZoom());
  }, [userLocation, map]);

  return (
    <Marker position={userLocation} icon={userIcon}>
      <Popup>
        <div className="text-center">
          <p className="font-bold">המיקום שלך</p>
        </div>
      </Popup>
    </Marker>
  );
}

const MapComponent = ({ points, userLocation, center, zoom }: MapProps) => {
  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      if (link && link.parentNode) {
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
        
        <LocationMarker userLocation={userLocation} />
        
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
      </MapContainer>
    </div>
  );
};

export default MapComponent; 
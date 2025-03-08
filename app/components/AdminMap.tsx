'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Point, Team } from '../types';
import { useState, useEffect } from 'react';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/images/marker-icon-2x.png',
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
});

// Custom icons
const pointIcon = new L.Icon({
  iconUrl: '/images/blue-marker.png',
  iconRetinaUrl: '/images/blue-marker-2x.png',
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
  shadowUrl: null,
  iconSize: [16, 16]
});

// Array of colors for teams
const teamColors = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFA500', // Orange
  '#800080', // Purple
  '#FF69B4', // Pink
  '#008000', // Dark Green
  '#FFD700', // Gold
  '#4B0082', // Indigo
  '#FF4500', // Orange Red
  '#2E8B57', // Sea Green
  '#8B4513', // Saddle Brown
  '#483D8B', // Dark Slate Blue
  '#FF1493', // Deep Pink
  '#00CED1'  // Dark Turquoise
];

function createTeamIcon(colorIndex: number) {
  const color = teamColors[colorIndex % teamColors.length];
  return L.divIcon({
    className: 'custom-team-marker',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

interface Props {
  points: Point[];
  teams: Team[];
  onPointClick?: (point: Point) => void;
  isEditable?: boolean;
}

function MapContent({ points, teams, onPointClick, isEditable }: Props) {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [draggableMarker, setDraggableMarker] = useState<L.Marker | null>(null);

  const map = useMapEvents({
    click: (e) => {
      if (isEditable && selectedPoint) {
        const { lat, lng } = e.latlng;
        if (draggableMarker) {
          draggableMarker.setLatLng([lat, lng]);
        }
        if (onPointClick && selectedPoint) {
          onPointClick({
            ...selectedPoint,
            location: [lat, lng]
          });
        }
      }
    }
  });

  // Render all points
  const pointMarkers = points.map((point) => (
    <Marker
      key={point._id}
      position={[point.location[0], point.location[1]]}
      icon={pointIcon}
      eventHandlers={{
        click: () => {
          if (onPointClick) {
            onPointClick(point);
          }
        }
      }}
    >
      <Popup>
        <div>
          <h3 className="font-bold">{point.name}</h3>
          <p>קוד: {point.code}</p>
          {point.question && (
            <div>
              <p>שאלה: {point.question.text}</p>
              <p>תשובה נכונה: {point.question.correctAnswer}</p>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  ));

  // Render all teams with unique colors
  const teamMarkers = teams.map((team, index) => {
    if (!team.currentLocation?.coordinates) return null;
    
    // Debug log for team location
    console.log(`Rendering team ${team.name}:`, {
      coordinates: team.currentLocation.coordinates,
      timestamp: team.currentLocation.timestamp
    });
    
    return (
      <Marker
        key={team._id}
        position={[team.currentLocation.coordinates[0], team.currentLocation.coordinates[1]]}
        icon={createTeamIcon(index)}
      >
        <Popup>
          <div>
            <h3 className="font-bold">{team.name}</h3>
            <p>עדכון אחרון: {new Date(team.currentLocation.timestamp).toLocaleString()}</p>
          </div>
        </Popup>
      </Marker>
    );
  });

  return (
    <>
      {pointMarkers}
      {teamMarkers}
    </>
  );
}

export default function AdminMap({ points, teams, onPointClick, isEditable }: Props) {
  return (
    <MapContainer
      center={[32.557, 35.077]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapContent
        points={points}
        teams={teams}
        onPointClick={onPointClick}
        isEditable={isEditable}
      />
    </MapContainer>
  );
} 
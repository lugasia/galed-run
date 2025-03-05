'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Point, Team } from '../../types';

// Import Map component dynamically to avoid SSR issues with Leaflet
const Map = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

export default function AdminMapPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Initial points data
  const initialPoints: Point[] = [
    { _id: '1', name: 'מעל הבית של נימה', code: '1001', coordinates: [32.5587, 35.0767] },
    { _id: '2', name: 'מקלט ליד הכלבו', code: '1002', coordinates: [32.5572, 35.0777] },
    { _id: '3', name: 'מקלט ליד גן היובל', code: '1003', coordinates: [32.5579, 35.0767] },
    { _id: '4', name: 'דירת אירוח', code: '1004', coordinates: [32.5568, 35.0778] },
    { _id: '5', name: 'מאחורי הבית של ניצן', code: '1005', coordinates: [32.5562, 35.0779] },
    { _id: '6', name: 'חישוק', code: '1006', coordinates: [32.5588, 35.0785] },
    { _id: '7', name: 'פינת חי', code: '1007', coordinates: [32.5561, 35.0793] },
    { _id: '8', name: 'מרפאה', code: '1008', coordinates: [32.5568, 35.0782] },
    { _id: '9', name: 'גן עופר', code: '1009', coordinates: [32.5574, 35.0763] },
    { _id: '10', name: 'מאחורי הבית של נטע', code: '1010', coordinates: [32.5565, 35.0771] },
    { _id: '11', name: 'פאב', code: '1011', coordinates: [32.5564, 35.0755] },
    { _id: '12', name: 'הכביש לגלעד', code: '1012', coordinates: [32.5680, 35.0783] },
    { _id: '13', name: 'דרך נוף גלעד', code: '1013', coordinates: [32.5586, 35.0604] },
  ];

  useEffect(() => {
    // Load points from API in production
    setPoints(initialPoints);

    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'LOCATION_UPDATE') {
        setTeams((prevTeams) => {
          const teamIndex = prevTeams.findIndex((t) => t._id === data.teamId);
          if (teamIndex === -1) return prevTeams;

          const newTeams = [...prevTeams];
          newTeams[teamIndex] = {
            ...newTeams[teamIndex],
            currentLocation: {
              coordinates: data.coordinates,
              timestamp: new Date(),
            },
          };
          return newTeams;
        });
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handlePointClick = (point: Point) => {
    setSelectedPoint(point);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">מפת ניווט</h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {isEditing ? 'סיום עריכה' : 'עריכת נקודות'}
            </button>
          </div>

          <Map
            points={points}
            teams={teams}
            onPointClick={handlePointClick}
            isEditable={isEditing}
          />

          {selectedPoint && (
            <div className="mt-4 p-4 border rounded-lg">
              <h2 className="text-xl font-bold mb-2">{selectedPoint.name}</h2>
              <p>קוד: {selectedPoint.code}</p>
              <p>
                מיקום: {selectedPoint.coordinates[0]}, {selectedPoint.coordinates[1]}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
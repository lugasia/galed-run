'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AdminNav from '../../components/AdminNav';
import type { Point, Team } from '../../types';
import { motion } from 'framer-motion';

const MapWithNoSSR = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

const TeamCard = ({ team }: { team: Team }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
  >
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-bold">{team.name}</h3>
        <p className="text-sm text-gray-600">{team.leaderName}</p>
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        team.startTime ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {team.startTime ? 'פעיל' : 'ממתין'}
      </div>
    </div>
    {team.currentLocation && team.currentLocation.coordinates && 
     Array.isArray(team.currentLocation.coordinates) && 
     team.currentLocation.coordinates.length === 2 && (
      <div className="mt-2 text-sm text-gray-500">
        מיקום: {team.currentLocation.coordinates[0].toFixed(6)}, {team.currentLocation.coordinates[1].toFixed(6)}
      </div>
    )}
  </motion.div>
);

export default function AdminMapPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [mapTeams, setMapTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchInitialData = async () => {
    try {
      // Fetch points - these rarely change
      const pointsResponse = await fetch('/api/points');
      if (!pointsResponse.ok) {
        throw new Error('Failed to fetch points');
      }
      const pointsData = await pointsResponse.json();
      setPoints(pointsData);

      // Fetch only active teams
      const teamsResponse = await fetch('/api/teams?active=true');
      if (!teamsResponse.ok) {
        throw new Error('Failed to fetch teams');
      }
      const teamsData = await teamsResponse.json();
      
      // All active teams for the list
      const activeTeams = teamsData.filter((team: Team) => 
        team.startTime && team.currentRoute
      );
      
      // Teams with valid locations for the map
      const teamsWithLocation = activeTeams.filter((team: Team) =>
        team.currentLocation?.coordinates &&
        Array.isArray(team.currentLocation.coordinates) &&
        team.currentLocation.coordinates.length === 2
      );

      setTeams(activeTeams);
      setMapTeams(teamsWithLocation);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'TEAM_LOCATION_UPDATE') {
        setTeams(prevTeams => {
          const updatedTeams = [...prevTeams];
          const teamIndex = updatedTeams.findIndex(t => t._id === data.team._id);
          
          if (teamIndex !== -1) {
            updatedTeams[teamIndex] = {
              ...updatedTeams[teamIndex],
              currentLocation: data.team.currentLocation
            };
          }
          return updatedTeams;
        });

        // Update map teams if location is valid
        if (data.team.currentLocation?.coordinates &&
            Array.isArray(data.team.currentLocation.coordinates) &&
            data.team.currentLocation.coordinates.length === 2) {
          setMapTeams(prevTeams => {
            const updatedTeams = [...prevTeams];
            const teamIndex = updatedTeams.findIndex(t => t._id === data.team._id);
            
            if (teamIndex !== -1) {
              updatedTeams[teamIndex] = {
                ...updatedTeams[teamIndex],
                currentLocation: data.team.currentLocation
              };
            } else {
              // Add to map teams if not already there
              const team = teams.find(t => t._id === data.team._id);
              if (team) {
                updatedTeams.push({
                  ...team,
                  currentLocation: data.team.currentLocation
                });
              }
            }
            return updatedTeams;
          });
        }
        setLastUpdate(new Date());
      } else if (data.type === 'TEAM_STATUS_UPDATE') {
        setTeams(prevTeams => {
          const updatedTeams = [...prevTeams];
          const teamIndex = updatedTeams.findIndex(t => t._id === data.team._id);
          
          if (teamIndex !== -1) {
            updatedTeams[teamIndex] = data.team;
          } else if (data.team.startTime && data.team.currentRoute) {
            updatedTeams.push(data.team);
          }
          return updatedTeams;
        });

        // Update map teams if team has valid location
        if (data.team.currentLocation?.coordinates &&
            Array.isArray(data.team.currentLocation.coordinates) &&
            data.team.currentLocation.coordinates.length === 2) {
          setMapTeams(prevTeams => {
            const updatedTeams = [...prevTeams];
            const teamIndex = updatedTeams.findIndex(t => t._id === data.team._id);
            
            if (teamIndex !== -1) {
              updatedTeams[teamIndex] = data.team;
            } else if (data.team.startTime && data.team.currentRoute) {
              updatedTeams.push(data.team);
            }
            return updatedTeams;
          });
        }
        setLastUpdate(new Date());
      }
    };

    // Fallback polling every 30 seconds only for active teams
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/teams?active=true');
        if (!response.ok) throw new Error('Failed to fetch teams');
        const data = await response.json();
        
        // All active teams for the list
        const activeTeams = data.filter((team: Team) => 
          team.startTime && team.currentRoute
        );
        
        // Teams with valid locations for the map
        const teamsWithLocation = activeTeams.filter((team: Team) =>
          team.currentLocation?.coordinates &&
          Array.isArray(team.currentLocation.coordinates) &&
          team.currentLocation.coordinates.length === 2
        );

        setTeams(activeTeams);
        setMapTeams(teamsWithLocation);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error in fallback polling:', error);
      }
    }, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <AdminNav />
      </div>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              מפת ניווט
            </h1>
            <div className="flex justify-between items-center">
              <p className="text-gray-600 mt-2">מעקב אחר התקדמות הקבוצות בזמן אמת</p>
              {lastUpdate && (
                <p className="text-sm text-gray-500">
                  עודכן לאחרונה: {new Date(lastUpdate).toLocaleTimeString('he-IL')}
                </p>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lg:col-span-3 bg-white rounded-2xl shadow-lg overflow-hidden relative z-10"
            >
              <div className="h-[70vh] relative">
                <MapWithNoSSR
                  points={points}
                  teams={mapTeams}
                  center={[32.557859, 35.076676]}
                  zoom={15}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-bold mb-3">סטטיסטיקה</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">קבוצות פעילות</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {teams.length}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">נקודות במסלול</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {points.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-bold mb-3">קבוצות</h2>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {teams.map((team) => (
                    <TeamCard key={team._id} team={team} />
                  ))}
                  {teams.length === 0 && (
                    <p className="text-gray-500 text-center py-4">
                      אין קבוצות פעילות כרגע
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="mr-3">
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Team, Point, Route } from '../../../types';

// Import Map component dynamically to avoid SSR issues with Leaflet
const Map = dynamic(() => import('../../../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

interface GameState {
  team: Team;
  currentPoint?: Point;
  route?: Route;
  showQuestion: boolean;
  attempts: number;
  penaltyEndTime?: Date;
}

export default function GamePage({ params }: { params: { teamId: string } }) {
  const [gameState, setGameState] = useState<GameState>({
    team: {} as Team,
    showQuestion: false,
    attempts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameState = async () => {
      try {
        const response = await fetch(`/api/game/${params.teamId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch game state');
        }
        const data = await response.json();
        setGameState((prev) => ({ ...prev, ...data }));
      } catch (error) {
        setError('שגיאה בטעינת המשחק');
        console.error('Error fetching game state:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameState();

    // Set up location tracking
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            await fetch('/api/location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                teamId: params.teamId,
                coordinates: [latitude, longitude],
              }),
            });
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [params.teamId]);

  const handleAnswerSubmit = async (answer: string) => {
    try {
      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: params.teamId,
          pointId: gameState.currentPoint?._id,
          answer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      if (data.correct) {
        setGameState((prev) => ({
          ...prev,
          showQuestion: false,
          attempts: 0,
          currentPoint: undefined,
        }));
      } else {
        setGameState((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          penaltyEndTime:
            prev.attempts + 1 >= (prev.route?.settings.maxAttempts || 3)
              ? new Date(Date.now() + (prev.route?.settings.penaltyTime || 1) * 60000)
              : undefined,
        }));
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">{gameState.team.name}</h1>
              {gameState.route && (
                <span className="mr-4 text-gray-600">מסלול: {gameState.route.name}</span>
              )}
            </div>
            {gameState.penaltyEndTime && new Date() < gameState.penaltyEndTime && (
              <div className="text-red-500">
                זמן עונשין: {Math.ceil((gameState.penaltyEndTime.getTime() - Date.now()) / 1000)} שניות
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 px-4">
        <Map
          points={gameState.route?.points || []}
          teams={[gameState.team]}
          onPointClick={(point) => {
            if (!gameState.penaltyEndTime || new Date() > gameState.penaltyEndTime) {
              setGameState((prev) => ({
                ...prev,
                currentPoint: point,
                showQuestion: true,
              }));
            }
          }}
        />

        {gameState.showQuestion && gameState.currentPoint?.question && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">{gameState.currentPoint.name}</h2>
              <p className="mb-4">{gameState.currentPoint.question.text}</p>
              <div className="space-y-2">
                {gameState.currentPoint.question.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswerSubmit(option)}
                    className="w-full p-3 text-right bg-gray-50 hover:bg-gray-100 rounded"
                  >
                    {option}
                  </button>
                ))}
              </div>
              {gameState.attempts > 0 && (
                <div className="mt-4 text-red-500">
                  נסיון {gameState.attempts + 1} מתוך{' '}
                  {gameState.route?.settings.maxAttempts || 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
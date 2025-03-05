'use client';

import React, { useState, useEffect } from 'react';
import type { Route, Point } from '../../types';

interface RouteFormData {
  name: string;
  points: string[];
  settings: {
    penaltyTime: number;
    maxAttempts: number;
  };
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRoute, setNewRoute] = useState<RouteFormData>({
    name: '',
    points: [],
    settings: {
      penaltyTime: 1,
      maxAttempts: 3,
    },
  });

  useEffect(() => {
    // Load routes and points from API
    const fetchData = async () => {
      try {
        const [routesRes, pointsRes] = await Promise.all([
          fetch('/api/routes'),
          fetch('/api/points'),
        ]);

        if (!routesRes.ok || !pointsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [routesData, pointsData] = await Promise.all([
          routesRes.json(),
          pointsRes.json(),
        ]);

        setRoutes(routesData);
        setPoints(pointsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRoute),
      });

      if (!response.ok) {
        throw new Error('Failed to create route');
      }

      const createdRoute = await response.json();
      setRoutes([...routes, createdRoute]);
      setShowAddRoute(false);
      setNewRoute({
        name: '',
        points: [],
        settings: {
          penaltyTime: 1,
          maxAttempts: 3,
        },
      });
    } catch (error) {
      console.error('Error creating route:', error);
    }
  };

  const handlePointToggle = (pointId: string) => {
    setNewRoute((prev) => ({
      ...prev,
      points: prev.points.includes(pointId)
        ? prev.points.filter((id) => id !== pointId)
        : [...prev.points, pointId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">ניהול מסלולים</h1>
            <button
              onClick={() => setShowAddRoute(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              יצירת מסלול חדש
            </button>
          </div>

          {showAddRoute && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <h2 className="text-xl font-bold mb-4">יצירת מסלול חדש</h2>
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם המסלול
                    </label>
                    <input
                      type="text"
                      value={newRoute.name}
                      onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      הגדרות
                    </label>
                    <div className="flex gap-4">
                      <div>
                        <label className="block text-sm text-gray-600">זמן עונשין (דקות)</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={newRoute.settings.penaltyTime}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              settings: {
                                ...newRoute.settings,
                                penaltyTime: parseInt(e.target.value),
                              },
                            })
                          }
                          className="w-24 p-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600">מספר נסיונות מקסימלי</label>
                        <input
                          type="number"
                          min="1"
                          value={newRoute.settings.maxAttempts}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              settings: {
                                ...newRoute.settings,
                                maxAttempts: parseInt(e.target.value),
                              },
                            })
                          }
                          className="w-24 p-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      נקודות במסלול
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {points.map((point) => (
                        <div
                          key={point._id}
                          className={`p-2 border rounded cursor-pointer ${
                            newRoute.points.includes(point._id)
                              ? 'bg-blue-50 border-blue-500'
                              : ''
                          }`}
                          onClick={() => handlePointToggle(point._id)}
                        >
                          <div className="font-medium">{point.name}</div>
                          <div className="text-sm text-gray-500">קוד: {point.code}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRoute(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      disabled={newRoute.points.length === 0}
                    >
                      שמירה
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {routes.map((route) => (
              <div
                key={route._id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{route.name}</h3>
                    <div className="mt-2 text-sm text-gray-600">
                      <div>זמן עונשין: {route.settings.penaltyTime} דקות</div>
                      <div>מספר נסיונות: {route.settings.maxAttempts}</div>
                      <div className="mt-1">
                        נקודות במסלול:{' '}
                        {points
                          .filter((p) => route.points.includes(p._id))
                          .map((p) => p.name)
                          .join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-500 hover:text-blue-600">עריכה</button>
                    <button className="text-red-500 hover:text-red-600">מחיקה</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 
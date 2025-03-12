'use client';

import React, { useState, useEffect } from 'react';
import { Point, Route } from '../../types';
import AdminNav from '../../components/AdminNav';
import { motion, AnimatePresence } from 'framer-motion';

const RouteCard = ({ route, onEdit, onDelete }: { 
  route: Route; 
  onEdit: (route: Route) => void;
  onDelete: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
  >
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-xl font-bold">{route.name}</h3>
        <p className="text-gray-600 mt-1">
          {route.points.length} נקודות במסלול
        </p>
      </div>
      <div className="flex space-x-2 rtl:space-x-reverse">
        <button
          onClick={() => onEdit(route)}
          className="text-blue-600 hover:text-blue-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(route._id)}
          className="text-red-600 hover:text-red-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        <span className="font-medium">הגדרות: </span>
        זמן עונשין: {route.settings?.penaltyTime || 1} דקות, 
        נסיונות מקסימלי: {route.settings?.maxAttempts || 3}
      </div>
      <div className="flex flex-wrap gap-2">
        {route.points.map((point: Point, index: number) => (
          <span 
            key={point._id}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          >
            {point.code}
          </span>
        ))}
      </div>
    </div>
  </motion.div>
);

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<Point[]>([]);
  const [availablePoints, setAvailablePoints] = useState<Point[]>([]);
  const [routeName, setRouteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [penaltyTime, setPenaltyTime] = useState(0.5);
  const [maxAttempts, setMaxAttempts] = useState(2);

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/routes');
      if (!response.ok) {
        throw new Error('Failed to fetch routes');
      }
      const data = await response.json();
      console.log('Fetched routes:', data);
      setRoutes(data);
    } catch (error) {
      console.error('Error fetching routes:', error);
      setError('שגיאה בטעינת המסלולים');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await fetch('/api/points?apiKey=prj_Y5PjW0xeNJLV0hCbA5qG4eVoOcGB');
      if (!response.ok) {
        throw new Error('Failed to fetch points');
      }
      const data = await response.json();
      console.log('Fetched points:', data);
      setAvailablePoints(data);
    } catch (error) {
      console.error('Error fetching points:', error);
      setError('שגיאה בטעינת הנקודות');
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchRoutes(), fetchPoints()]);
      } catch (error) {
        console.error('Error in init:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const handlePointToggle = (point: Point) => {
    setSelectedPoints(prev => {
      const exists = prev.find(p => p._id === point._id);
      if (exists) {
        return prev.filter(p => p._id !== point._id);
      } else {
        return [...prev, point];
      }
    });
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setRouteName(route.name);
    setPenaltyTime(route.settings?.penaltyTime || 1);
    setMaxAttempts(route.settings?.maxAttempts || 3);
    
    // Set the selected points from the route
    setSelectedPoints(route.points);
    setShowAddRoute(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeName || selectedPoints.length === 0) return;

    try {
      // Get the point IDs in the correct order
      const orderedPointIds = selectedPoints.map(point => point._id);

      const settings = {
        penaltyTime: Number(penaltyTime),
        maxAttempts: Number(maxAttempts)
      };

      if (editingRoute) {
        // Update existing route
        const response = await fetch(`/api/routes/${editingRoute._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: routeName,
            points: orderedPointIds,
            active: true,
            settings
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update route');
        }
      } else {
        // Create new route with existing points
        const routeResponse = await fetch('/api/routes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: routeName,
            points: orderedPointIds,
            active: true,
            settings
          }),
        });

        if (!routeResponse.ok) {
          const error = await routeResponse.json();
          throw new Error(error.details || 'Failed to create route');
        }
      }
      
      await fetchRoutes(); // Refresh the routes list
      setRouteName('');
      setSelectedPoints([]);
      setPenaltyTime(1);
      setMaxAttempts(3);
      setShowAddRoute(false);
      setEditingRoute(null);
    } catch (error: any) {
      console.error('Error saving route:', error);
      alert(error.message || 'Failed to save route. Please try again.');
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המסלול?')) {
      return;
    }

    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete route');
      }
      
      await fetchRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('שגיאה במחיקת המסלול');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AdminNav />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AdminNav />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6"
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routes.map((route) => (
                <RouteCard
                  key={route._id}
                  route={route}
                  onEdit={handleEditRoute}
                  onDelete={handleDeleteRoute}
                />
              ))}
            </div>

            <AnimatePresence>
              {showAddRoute && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {editingRoute ? 'עריכת מסלול' : 'יצירת מסלול חדש'}
                      </h2>
                      <button
                        onClick={() => {
                          setShowAddRoute(false);
                          setRouteName('');
                          setSelectedPoints([]);
                          setEditingRoute(null);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          שם המסלול
                        </label>
                        <input
                          type="text"
                          value={routeName}
                          onChange={(e) => setRouteName(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            זמן עונשין (דקות)
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            value={penaltyTime}
                            onChange={(e) => setPenaltyTime(Number(e.target.value))}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            מספר נסיונות מקסימלי
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={maxAttempts}
                            onChange={(e) => setMaxAttempts(Number(e.target.value))}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          נקודות במסלול
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {availablePoints.map((point) => (
                            <div
                              key={point._id}
                              onClick={() => handlePointToggle(point)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                selectedPoints.find(p => p._id === point._id)
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{point.name}</div>
                                  <div className="text-sm text-gray-600">קוד: {point.code}</div>
                                </div>
                                {selectedPoints.find(p => p._id === point._id) && (
                                  <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-4 rtl:space-x-reverse">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddRoute(false);
                            setRouteName('');
                            setSelectedPoints([]);
                            setEditingRoute(null);
                          }}
                          className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          ביטול
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium
                            hover:shadow-lg transform hover:scale-[1.02] transition-all"
                        >
                          {editingRoute ? 'עדכון' : 'יצירה'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <AdminNav />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ניהול מסלולים
              </h1>
              <p className="text-gray-600 mt-2">יצירה ועריכה של מסלולי ניווט</p>
            </div>
            <button
              onClick={() => setShowAddRoute(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium
                hover:shadow-lg transform hover:scale-[1.02] transition-all"
            >
              מסלול חדש
            </button>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6"
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routes.map((route) => (
              <RouteCard
                key={route._id}
                route={route}
                onEdit={handleEditRoute}
                onDelete={handleDeleteRoute}
              />
            ))}
          </div>

          <AnimatePresence>
            {showAddRoute && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {editingRoute ? 'עריכת מסלול' : 'יצירת מסלול חדש'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowAddRoute(false);
                        setRouteName('');
                        setSelectedPoints([]);
                        setEditingRoute(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        שם המסלול
                      </label>
                      <input
                        type="text"
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          זמן עונשין (דקות)
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          value={penaltyTime}
                          onChange={(e) => setPenaltyTime(Number(e.target.value))}
                          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          מספר נסיונות מקסימלי
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(Number(e.target.value))}
                          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        נקודות במסלול
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availablePoints.map((point) => (
                          <div
                            key={point._id}
                            onClick={() => handlePointToggle(point)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              selectedPoints.find(p => p._id === point._id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{point.name}</div>
                                <div className="text-sm text-gray-600">קוד: {point.code}</div>
                              </div>
                              {selectedPoints.find(p => p._id === point._id) && (
                                <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4 rtl:space-x-reverse">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddRoute(false);
                          setRouteName('');
                          setSelectedPoints([]);
                          setEditingRoute(null);
                        }}
                        className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        ביטול
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium
                          hover:shadow-lg transform hover:scale-[1.02] transition-all"
                      >
                        {editingRoute ? 'עדכון' : 'יצירה'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 
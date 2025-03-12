'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminNav from '../../components/AdminNav';

type EventType = 'ROUTE_STARTED' | 'ROUTE_COMPLETED';

interface EventWithDetails {
  _id: string;
  team: {
    name: string;
    leaderName: string;
  };
  type: EventType;
  route?: {
    name: string;
  };
  details?: any;
  createdAt: string;
}

const EventCard = ({ event }: { event: EventWithDetails }) => {
  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'ROUTE_STARTED':
        return '🏁';
      case 'ROUTE_COMPLETED':
        return '🎉';
      default:
        return '📝';
    }
  };

  const getEventTypeText = (type: EventType) => {
    switch (type) {
      case 'ROUTE_STARTED':
        return 'התחיל מסלול';
      case 'ROUTE_COMPLETED':
        return 'סיים מסלול';
      default:
        return type;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div className="text-2xl">{getEventIcon(event.type)}</div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold">{event.team?.name || 'קבוצה לא ידועה'}</h3>
              <p className="text-sm text-gray-600">{getEventTypeText(event.type)}</p>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(event.createdAt).toLocaleString('he-IL')}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {event.route && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700">
                <span className="font-medium">מסלול:</span>
                <span className="mr-1">{event.route.name}</span>
              </div>
            )}
            {event.details && event.type === 'ROUTE_COMPLETED' && (
              <div className="text-sm text-gray-600 mt-2">
                זמן סופי: {formatTime(event.details.finalTime)}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('שגיאה בטעינת האירועים');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_EVENT') {
        setEvents((prevEvents) => [data.event, ...prevEvents]);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleClearEvents = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל האירועים? פעולה זו אינה הפיכה.')) {
      return;
    }

    try {
      setClearing(true);
      const response = await fetch('/api/events', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear events');
      }

      setEvents([]);
    } catch (error) {
      console.error('Error clearing events:', error);
      setError('שגיאה במחיקת האירועים');
    } finally {
      setClearing(false);
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
                יומן אירועים
              </h1>
              <p className="text-gray-600 mt-2">מעקב אחר פעילות בזמן אמת</p>
            </div>
            <button
              onClick={handleClearEvents}
              disabled={clearing || events.length === 0}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl font-medium
                hover:shadow-lg transform hover:scale-[1.02] transition-all
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none"
            >
              {clearing ? 'מוחק...' : 'נקה יומן'}
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

          <div className="space-y-4">
            <AnimatePresence>
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </AnimatePresence>

            {events.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-xl shadow-lg p-12 text-center"
              >
                <div className="text-4xl mb-4">📝</div>
                <p className="text-gray-500">אין אירועים להצגה</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
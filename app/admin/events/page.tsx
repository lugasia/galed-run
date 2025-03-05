'use client';

import React, { useState, useEffect } from 'react';
import type { Event, Team, Point, Route } from '../../types';

interface EventWithDetails extends Omit<Event, 'team' | 'point' | 'route'> {
  team: Team;
  point?: Point;
  route?: Route;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getEventTypeText = (type: Event['type']) => {
    switch (type) {
      case 'POINT_REACHED':
        return 'הגיע לנקודה';
      case 'QUESTION_ANSWERED':
        return 'ענה על שאלה';
      case 'ROUTE_STARTED':
        return 'התחיל מסלול';
      case 'ROUTE_COMPLETED':
        return 'סיים מסלול';
      case 'PENALTY_APPLIED':
        return 'קיבל עונשין';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">יומן אירועים</h1>
          </div>

          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event._id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{event.team.name}</h3>
                    <div className="mt-1 text-sm text-gray-600">
                      <div>{getEventTypeText(event.type)}</div>
                      {event.point && <div>נקודה: {event.point.name}</div>}
                      {event.route && <div>מסלול: {event.route.name}</div>}
                      {event.details && (
                        <div className="mt-1">
                          {typeof event.details === 'string'
                            ? event.details
                            : JSON.stringify(event.details)}
                        </div>
                      )}
                      <div className="mt-1 text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {event.location && (
                    <div className="text-sm text-gray-500">
                      מיקום: {event.location.coordinates.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                אין אירועים להצגה
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
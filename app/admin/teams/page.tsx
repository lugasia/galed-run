'use client';

import React, { useState, useEffect } from 'react';
import AdminNav from '../../components/AdminNav';
import type { Route } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface Team {
  _id: string;
  name: string;
  leaderName: string;
  currentRoute?: Route;
  uniqueLink: string;
  active: boolean;
  startTime?: Date;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    fetchRoutes();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/routes');
      if (!response.ok) throw new Error('Failed to fetch routes');
      const data = await response.json();
      setRoutes(data);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoute) {
      alert('נא לבחור מסלול');
      return;
    }

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teamName,
          leaderName: leaderName,
          currentRoute: selectedRoute._id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to create team');
      }

      const newTeam = await response.json();
      setTeams([...teams, newTeam]);
      
      // Reset form
      setTeamName('');
      setLeaderName('');
      setSelectedRoute(null);
      setShowAddTeam(false);
      
      alert('הקבוצה נוצרה בהצלחה!');
    } catch (error) {
      console.error('Error creating team:', error);
      alert('שגיאה ביצירת הקבוצה: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCopyLink = (link: string) => {
    // וודא שהלינק הוא מלא
    const fullLink = getFullLink(link);
    navigator.clipboard.writeText(fullLink);
    alert('הקישור הועתק ללוח!');
  };

  const handleStartRace = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _id: teamId,
          startTime: new Date()
        }),
      });

      if (!response.ok) throw new Error('Failed to start race');
      await fetchTeams();
      alert('המירוץ התחיל!');
    } catch (error) {
      console.error('Error starting race:', error);
      alert('שגיאה בהתחלת המירוץ');
    }
  };

  const handleRestartRace = async (teamId: string) => {
    if (!confirm('האם אתה בטוח שברצונך לאפס את המירוץ לקבוצה זו?')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _id: teamId,
          startTime: null,
          currentPointIndex: 0,
          visitedPoints: [],
          attempts: 0,
          penaltyEndTime: null,
          hintRequested: null
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to restart race');
      }

      await fetchTeams();
      alert('המירוץ אופס בהצלחה!');
    } catch (error) {
      console.error('Error restarting race:', error);
      alert('שגיאה באיפוס המירוץ');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הקבוצה?')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams?id=${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete team');
      
      setTeams(teams.filter(team => team._id !== teamId));
      alert('הקבוצה נמחקה בהצלחה!');
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('שגיאה במחיקת הקבוצה');
    }
  };

  const getFullLink = (uniqueLink: string) => {
    // אם הלינק כבר בפורמט הנכון (https://domain/game/id), החזר אותו כמו שהוא
    if (uniqueLink.startsWith('https://') && uniqueLink.includes('/game/') && !uniqueLink.includes('/admin/')) {
      return uniqueLink;
    }
    
    // הסר @ מהתחלת הלינק אם קיים
    let cleanLink = uniqueLink;
    if (cleanLink.startsWith('@')) {
      cleanLink = cleanLink.substring(1);
    }
    
    // תקן לינקים שמכילים /admin/game/ במקום /game/
    if (cleanLink.includes('/admin/game/')) {
      cleanLink = cleanLink.replace('/admin/game/', '/game/');
    }
    
    // אם הלינק לא מתחיל ב-https://, הוסף אותו
    if (!cleanLink.startsWith('https://')) {
      // אם הלינק מתחיל עם הדומיין
      if (cleanLink.startsWith('galedrun.vercel.app')) {
        cleanLink = `https://${cleanLink}`;
      } 
      // אם הלינק מתחיל עם /game/
      else if (cleanLink.startsWith('/game/')) {
        cleanLink = `https://galedrun.vercel.app${cleanLink}`;
      }
      // אם הלינק הוא רק המזהה
      else if (!cleanLink.includes('/')) {
        cleanLink = `https://galedrun.vercel.app/game/${cleanLink}`;
      }
    }
    
    return cleanLink;
  };

  const handleUpdateAllLinks = async () => {
    try {
      const response = await fetch('/api/teams?updateLinks=true');
      if (!response.ok) throw new Error('Failed to update links');
      const data = await response.json();
      setTeams(data);
      alert('כל הלינקים עודכנו בהצלחה!');
    } catch (error) {
      console.error('Error updating links:', error);
      alert('שגיאה בעדכון הלינקים');
    }
  };

  const handleStartAllWaitingTeams = async () => {
    try {
      const response = await fetch('/api/teams/start-all-waiting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) throw new Error('Failed to start races');
      await fetchTeams();
      alert('כל המירוצים התחילו!');
    } catch (error) {
      console.error('Error starting races:', error);
      alert('שגיאה בהתחלת המירוצים');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminNav />
        <div className="p-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            </div>
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
                ניהול קבוצות
              </h1>
              <p className="text-gray-600 mt-2">ניהול קבוצות ומשתתפים במירוץ</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddTeam(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium
                  hover:shadow-lg transform hover:scale-[1.02] transition-all"
              >
                הוסף קבוצה חדשה
              </button>
              {teams.some(team => !team.startTime) && (
                <button
                  onClick={handleStartAllWaitingTeams}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-green-700 transition-colors"
                >
                  התחל מירוץ לכל הממתינים
                </button>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team, index) => (
              <motion.div
                key={team._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{team.name}</h3>
                    <p className="text-gray-600">מוביל: {team.leaderName}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    team.startTime 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {team.startTime ? 'פעיל' : 'ממתין'}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {team.currentRoute && (
                    <p className="text-gray-600">
                      <span className="font-medium">מסלול: </span>
                      {team.currentRoute.name}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={getFullLink(team.uniqueLink)}
                      readOnly
                      className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-200"
                    />
                    <button
                      onClick={() => handleCopyLink(getFullLink(team.uniqueLink))}
                      className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                      title="העתק קישור"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <a
                      href={getFullLink(team.uniqueLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50"
                      title="פתח קישור"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <div className="flex gap-2">
                    {!team.startTime ? (
                      <button
                        onClick={() => handleStartRace(team._id)}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-medium
                          hover:shadow-lg transform hover:scale-[1.02] transition-all"
                      >
                        התחל מירוץ
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestartRace(team._id)}
                        className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-4 py-2 rounded-lg font-medium
                          hover:shadow-lg transform hover:scale-[1.02] transition-all"
                      >
                        אפס מירוץ
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTeam(team._id)}
                      className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-medium
                        hover:shadow-lg transform hover:scale-[1.02] transition-all"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <AnimatePresence>
            {showAddTeam && (
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
                  className="bg-white rounded-2xl p-8 max-w-lg w-full"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      הוספת קבוצה חדשה
                    </h2>
                    <button
                      onClick={() => {
                        setShowAddTeam(false);
                        setTeamName('');
                        setLeaderName('');
                        setSelectedRoute(null);
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
                        שם הקבוצה
                      </label>
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        שם מוביל
                      </label>
                      <input
                        type="text"
                        value={leaderName}
                        onChange={(e) => setLeaderName(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        מסלול
                      </label>
                      <select
                        value={selectedRoute?._id || ''}
                        onChange={(e) => {
                          const route = routes.find(r => r._id === e.target.value);
                          setSelectedRoute(route || null);
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        required
                      >
                        <option value="">בחר מסלול</option>
                        {routes.map((route) => (
                          <option key={route._id} value={route._id}>
                            {route.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end space-x-4 rtl:space-x-reverse">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddTeam(false);
                          setTeamName('');
                          setLeaderName('');
                          setSelectedRoute(null);
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
                        הוספה
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
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import GpsRequired from '../../components/GpsRequired';
import { Point as GamePoint, Team as GameTeam } from '../../types';
import { motion } from 'framer-motion';

const Map = dynamic(() => import('../../components/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  )
});

interface Point extends GamePoint {}

interface Team {
  _id: string;
  name: string;
  leaderName: string;
  currentRoute?: {
    _id: string;
    name: string;
    points: Point[];
  };
  uniqueLink: string;
  active: boolean;
  startTime?: Date;
  currentPointIndex: number;
  visitedPoints: string[];
  attempts: number;
  penaltyEndTime?: Date;
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatPenaltyTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function GamePage({ params }: { params: { teamId: string } }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyEndTime, setPenaltyEndTime] = useState<Date | null>(null);
  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState<number>(0);

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 10000); // Refresh every 10 seconds

    // Start GPS tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(newLocation);
          setError(null); // Clear any previous location errors

          // Send location update to server
          try {
            const response = await fetch(`/api/teams/${params.teamId}/location`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                location: newLocation,
                uniqueLink: team?.uniqueLink
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              console.error('Server error updating location:', data);
            }
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          let errorMessage = 'שגיאה בקבלת המיקום';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'אנא אפשר גישה למיקום בדפדפן';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'מידע המיקום אינו זמין';
              break;
            case error.TIMEOUT:
              errorMessage = 'תם הזמן לקבלת המיקום - מנסה שוב...';
              break;
          }
          setError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000, // Allow cached positions up to 30 seconds old
          timeout: 27000 // Wait up to 27 seconds for a position
        }
      );

      return () => {
        clearInterval(interval);
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setError('הדפדפן שלך לא תומך בשירותי מיקום');
    }

    return () => clearInterval(interval);
  }, [team?.uniqueLink]);

  useEffect(() => {
    if (team?.startTime) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(team.startTime).getTime();
        setElapsedTime(now - start);
      }, 1000); // Update every second since we don't need milliseconds anymore
      return () => clearInterval(interval);
    }
  }, [team?.startTime]);

  useEffect(() => {
    if (penaltyEndTime) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(penaltyEndTime).getTime();
        const timeLeft = end - now;
        
        if (timeLeft <= 0) {
          // Penalty time is over
          setPenaltyTimeLeft(0);
          setPenaltyEndTime(null);
          
          // Move to next point when penalty ends
          if (team && team._id) {
            fetch(`/api/teams/${team._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                currentPointIndex: team.currentPointIndex + 1
              }),
            }).then(() => {
              fetchTeam(); // Refresh team data to get next point info
            }).catch(error => {
              console.error('Error updating point index:', error);
              setError('שגיאה בעדכון הנקודה הבאה');
            });
          }
          
          clearInterval(interval);
        } else {
          setPenaltyTimeLeft(timeLeft);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [penaltyEndTime, team]);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`/api/game/${params.teamId}`);
      if (!response.ok) throw new Error('Failed to fetch team data');
      const data = await response.json();
      
      setTeam(data.team);
      if (data.team?.currentRoute?.points) {
        setPoints(data.team.currentRoute.points);
      }
      
      // Check if team has a penalty
      if (data.team?.penaltyEndTime) {
        const penaltyEnd = new Date(data.team.penaltyEndTime);
        if (penaltyEnd > new Date()) {
          setPenaltyEndTime(penaltyEnd);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team:', error);
      setError('שגיאה בטעינת נתוני הקבוצה');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!team || !points.length) return;
    
    const currentPoint = points[team.currentPointIndex];
    if (!currentPoint) return;

    try {
      const response = await fetch('/api/points/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: params.teamId,
          code: currentPoint.code,
          location: userLocation,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowQuestion(true);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error verifying point:', error);
      setError('שגיאה באימות הקוד');
    }
  };

  const handleAnswerSubmit = async () => {
    if (!selectedAnswer || !team || !points) return;

    try {
      const currentPoint = points[team.currentPointIndex];
      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: params.teamId,
          pointId: currentPoint._id,
          answer: selectedAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'שגיאה בשליחת התשובה');
        return;
      }

      if (data.correct) {
        // Update team's current point index
        const updateResponse = await fetch(`/api/teams/${team._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPointIndex: team.currentPointIndex + 1
          }),
        });

        if (!updateResponse.ok) {
          setError('שגיאה בעדכון הנקודה הבאה');
          return;
        }

        // Show success message with next point info
        if (data.nextPoint) {
          setError(`${data.message} - ${data.nextPoint.name} (קוד: ${data.nextPoint.code})`);
          setSelectedAnswer('');
          setShowQuestion(false);
          await fetchTeam();
        } else {
          setError(data.message);
          setSelectedAnswer('');
          setShowQuestion(false);
          await fetchTeam();
        }
      } else {
        // Check if this is a penalty
        if (data.penaltyEndTime) {
          // Set the penalty end time
          setPenaltyEndTime(new Date(data.penaltyEndTime));
          setError(data.message);
          setSelectedAnswer('');
          setShowQuestion(false);
          await fetchTeam();
        } 
        // Show error message with next point info if available
        else if (data.nextPoint) {
          setError(`${data.message} - הנקודה הבאה: ${data.nextPoint.name} (קוד: ${data.nextPoint.code})`);
          setSelectedAnswer('');
          setShowQuestion(false);
          await fetchTeam();
        } else {
          console.log('Incorrect answer response:', data); // Debug log
          setError(data.message);
          setSelectedAnswer(''); // Just clear the selected answer but keep the question visible
          // Don't hide the question for first and second attempts
          if (!data.message.includes('טעות')) {
            setShowQuestion(false);
          }
          await fetchTeam(); // Always fetch team to get updated attempts count
        }
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('שגיאה בשליחת התשובה');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">קבוצה לא נמצאה</h1>
          <p className="text-gray-600">הקישור שהזנת אינו תקין</p>
        </div>
      </div>
    );
  }

  if (!team.startTime) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">המירוץ טרם התחיל</h1>
          <div className="space-y-4">
            <div className="text-gray-600">
              <p className="font-medium">פרטי הקבוצה:</p>
              <p>שם: {team.name}</p>
              <p>מוביל: {team.leaderName}</p>
              {team.currentRoute && <p>מסלול: {team.currentRoute.name}</p>}
            </div>
            <p className="text-sm text-gray-500">
              המתינו למנהל המשחק שיתחיל את המירוץ עבור הקבוצה שלכם
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentPoint = team && points.length > 0 ? points[team.currentPointIndex] : null;
  
  // Check if the route is completed
  const isRouteCompleted = team?.currentPointIndex >= points.length;
  
  if (isRouteCompleted) {
    return (
      <div className="flex flex-col h-screen">
        <div className="bg-white shadow-md p-2">
          <div className="text-center text-2xl font-bold">
            {formatTime(elapsedTime)}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="text-center max-w-md w-full bg-white rounded-lg shadow-lg p-4">
            <h1 className="text-2xl font-bold mb-2">סיימתם את המסלול!</h1>
            <p className="text-gray-600 mb-2">כל הכבוד!</p>
            <div className="text-xl font-bold">
              זמן סופי: {formatTime(elapsedTime)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPoint) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">שגיאה בטעינת הנקודה</h1>
          <p className="text-gray-600">נסו לרענן את העמוד</p>
        </div>
      </div>
    );
  }

  const isLastPoint = team?.currentPointIndex === points.length - 1;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="h-5"></div>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg p-2"
      >
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold">{team.name}</h1>
          <div className="text-3xl font-mono tracking-wider">
            {formatTime(elapsedTime)}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
              נקודה {team?.currentPointIndex + 1} מתוך {points.length}
            </span>
            {penaltyTimeLeft > 0 && (
              <span className="bg-red-500/80 px-2 py-0.5 rounded-full backdrop-blur-sm">
                עונש: {formatPenaltyTime(penaltyTimeLeft)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <div className="p-3 space-y-3 flex-1 overflow-auto">
        {penaltyTimeLeft > 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl shadow-lg p-6 text-center"
          >
            <h2 className="text-2xl font-bold mb-3">נפסלתם!</h2>
            <p className="text-lg opacity-90">
              המתינו {formatPenaltyTime(penaltyTimeLeft)} לקבלת הנקודה הבאה
            </p>
          </motion.div>
        ) : showQuestion ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-100 p-1.5 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold flex-1 leading-tight">{currentPoint.question.text}</h2>
            </div>
            <div className="space-y-1.5 mt-2">
              {currentPoint.question.options.map((option, index) => (
                <label 
                  key={index} 
                  className={`flex items-center px-2 py-1.5 rounded transition-all cursor-pointer text-sm
                    ${selectedAnswer === option 
                      ? 'bg-blue-50 border border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'}`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={selectedAnswer === option}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    className="w-3 h-3 text-blue-600 mr-2"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleAnswerSubmit}
              disabled={!selectedAnswer}
              className="mt-2 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-1.5 px-3 rounded text-sm font-medium
                disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-60 
                transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLastPoint ? 'סיים מסלול' : 'שלח'}
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">קוד נקודה: {currentPoint.code}</h2>
                <p className="text-gray-600 text-sm mt-1">הגעתם לנקודה? הזינו את הקוד שמופיע במקום</p>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-4 rounded-xl font-medium
                transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              הגעתי לנקודה
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
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

      <div className="relative h-[40vh]">
        <Map
          points={points.slice(0, team?.currentPointIndex + 1)}
          userLocation={userLocation || [32.557859, 35.076676]}
          center={[32.557859, 35.076676]}
          zoom={15}
        />
      </div>
    </div>
  );
} 
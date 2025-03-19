'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import GpsRequired from '../../components/GpsRequired';
import { Point as GamePoint, Team as GameTeam } from '../../types';
import { motion } from 'framer-motion';

// הוספת הצהרת טיפוס לחלון
declare global {
  interface Window {
    debugInfo: any;
    setGPS: (lat: number, lng: number) => void;
    debugState: () => void;
  }
}

const Map = dynamic(() => import('../../components/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  )
});

interface Point extends GamePoint {
  images?: {
    zoomIn: string;
    zoomOut: string;
  };
  isAdvanced?: boolean;
  isFinishPoint?: boolean;
  question: {
    text: string;
    options: string[];
    correctAnswer: string;
    image?: string;
  };
}

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
  hintRequested?: {
    pointIndex: number;
    hintLevel: number; // 1 = זום אאוט, 2 = שם התחנה
    timestamp: Date;
  };
}

// פונקציית עזר לזיהוי נקודת הסיום בצורה עקבית
const isFinishPoint = (point: Point | null, points: Point[]): boolean => {
  if (!point || !points.length) return false;
  // נקודת הסיום היא תמיד הנקודה האחרונה במערך הנקודות
  return points.indexOf(point) === points.length - 1;
};

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

// פונקציה לחישוב מרחק בין שתי נקודות בקילומטרים
const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  
  const R = 6371; // רדיוס כדור הארץ בקילומטרים
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
};

export default function GamePage({ params }: { params: { teamId: string } }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyEndTime, setPenaltyEndTime] = useState<Date | null>(null);
  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState<number>(0);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [showPointImage, setShowPointImage] = useState(false);
  const [completedPoints, setCompletedPoints] = useState<Point[]>([]);
  const [disabledOptions, setDisabledOptions] = useState<string[]>([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 10000); // Refresh every 10 seconds

    // Start GPS tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log('GPS Update:', { newLocation, timestamp: new Date().toISOString() });
          setUserLocation(newLocation);

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
          // אם יש שגיאת GPS, הצג הודעה למשתמש
          if (error.code === 3) { // Timeout
            setMessage('לא הצלחנו לקבל את המיקום שלך. נסה לרענן את העמוד או להפעיל מחדש את ה-GPS.');
          } else if (error.code === 1) { // Permission denied
            setMessage('אנא אפשר גישה למיקום כדי להמשיך במשחק.');
          } else if (error.code === 2) { // Position unavailable
            setMessage('לא ניתן לקבל את המיקום שלך כרגע. נסה לצאת לאזור פתוח יותר.');
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000, // Allow cached positions up to 5 seconds old
          timeout: 30000 // Wait up to 30 seconds for a position
        }
      );

      return () => {
        clearInterval(interval);
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setMessage('הדפדפן שלך לא תומך ב-GPS. נסה להשתמש בדפדפן אחר.');
    }

    return () => clearInterval(interval);
  }, [team?.uniqueLink]);

  // Completely rewritten timer logic
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Only start timer if game is not completed and team has started
    if (team?.startTime && !gameCompleted) {
      console.log('Starting timer, gameCompleted:', gameCompleted);
      
      // Set initial time
      const now = new Date().getTime();
      const start = new Date(team.startTime).getTime();
      setElapsedTime(now - start);
      
      // Start interval
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(team.startTime).getTime();
        setElapsedTime(now - start);
      }, 1000);
      
      // Cleanup function
      return () => {
        console.log('Cleaning up timer');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [team?.startTime, gameCompleted]);

  // Separate effect to handle game completion
  useEffect(() => {
    if (gameCompleted && finalTime !== null) {
      console.log('Game completed effect triggered, finalTime:', finalTime);
      
      // Stop the timer if it's still running
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log('Timer stopped in completion effect');
      }
      
      // Save completion time to server
      const teamId = team?.uniqueLink?.split('/').pop() || team?._id;
      if (teamId) {
        console.log('Saving completion time to server:', finalTime);
        fetch(`/api/game/${teamId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            completionTime: finalTime,
            finalTime: finalTime,
            completedAt: new Date().toISOString()
          }),
        }).then(response => {
          console.log('Completion time saved, response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }).catch(error => {
          console.error('Error saving completion time:', error);
        });
      }
    }
  }, [gameCompleted, finalTime, team]);

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
          
          // When penalty ends, show the zoom out image (hint level 1)
          setCurrentHintLevel(1);
          
          // אם זה הניסיון השלישי (אחרי עונשין שני), הצג את שם הנקודה
          if (team?.attempts >= 3) {
            setCurrentHintLevel(2);
            setMessage('קיבלת את שם הנקודה כרמז');
          }
          
          clearInterval(interval);
        } else {
          setPenaltyTimeLeft(timeLeft);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [penaltyEndTime, team?.attempts]);

  useEffect(() => {
    console.log('Current game state:', {
      currentPointIndex: team?.currentPointIndex,
      visitedPoints: team?.visitedPoints,
      currentPoint: team?.currentRoute?.points[team?.currentPointIndex || 0],
      completedPoints
    });
  }, [team, team?.currentRoute?.points, team?.currentPointIndex, team?.visitedPoints, completedPoints]);

  const fetchTeam = async () => {
    try {
      console.log('Fetching team data...');
      // נסה לקבל קבוצה לפי המזהה
      const response = await fetch(`/api/game/${params.teamId}`, {
        // Add cache control headers to prevent caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        console.error('Error response from server:', response.status, response.statusText);
        
        // נסה לקרוא את הודעת השגיאה מהשרת
        try {
          const errorData = await response.json();
          console.error('Error data:', errorData);
          
          // שמור את המידע הדיאגנוסטי
          if (errorData.debug) {
            console.log('Debug info:', errorData.debug);
            window.debugInfo = errorData.debug;
          }
          
          // אם לא נמצאה קבוצה, נסה לקבל קבוצה פעילה כלשהי
          if (response.status === 404) {
            console.log('Team not found, trying to get any active team');
            const activeTeamsResponse = await fetch('/api/teams/active', {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (activeTeamsResponse.ok) {
              const activeTeamsData = await activeTeamsResponse.json();
              
              if (activeTeamsData.teams && activeTeamsData.teams.length > 0) {
                console.log('Found active teams:', activeTeamsData.teams);
                
                // השתמש בקבוצה הראשונה שנמצאה
                const firstActiveTeam = activeTeamsData.teams[0];
                console.log('Using first active team:', firstActiveTeam);
                
                // נסה לקבל את הקבוצה המלאה
                const teamResponse = await fetch(`/api/game/${firstActiveTeam._id}`, {
                  headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  }
                });
                
                if (teamResponse.ok) {
                  const teamData = await teamResponse.json();
                  if (teamData.team) {
                    console.log('Successfully fetched active team');
                    setTeam(teamData.team);
                    processTeamData(teamData.team);
                    setLoading(false);
                    return;
                  }
                }
              }
            }
          }
          
          setMessage(errorData.message || 'קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          setMessage('קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
        }
        
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Team data fetched successfully:', {
        teamId: data.team?._id,
        name: data.team?.name,
        currentPointIndex: data.team?.currentPointIndex
      });
      
      if (!data.team) {
        console.error('No team data in response');
        setMessage('קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
        setLoading(false);
        return;
      }
      
      setTeam(data.team);
      processTeamData(data.team);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team:', error);
      setMessage('שגיאה בטעינת נתוני הקבוצה. נסה לרענן את העמוד.');
      setLoading(false);
    }
  };
  
  // פונקציה לעיבוד נתוני הקבוצה
  const processTeamData = (teamData: any) => {
    if (!teamData) return;

    console.log('processTeamData debug:', {
      serverPointIndex: teamData.currentPointIndex,
      totalPoints: points?.length,
      visitedPoints: teamData.visitedPoints || [],
      isRouteCompleted: teamData.currentRoute?.isCompleted,
      gameCompleted: teamData.gameCompleted,
    });

    // Use local state if it's ahead of server state (to prevent rollback)
    const localIndex = team?.currentPointIndex || 0;
    const serverIndex = teamData.currentPointIndex || 0;
    
    // If we have local state and it's ahead of the server, use it
    const useLocalIndex = localIndex > serverIndex;
    
    // Final point index to use, prioritizing local progress
    const finalPointIndex = useLocalIndex ? localIndex : serverIndex;
    
    console.log('Progress preservation:', {
      localIndex,
      serverIndex,
      useLocalIndex,
      finalPointIndex
    });

    // Update team with the correct point index
    const updatedTeam = {
      ...teamData,
      currentPointIndex: finalPointIndex,
    };

    // Set points if available from server
    if (teamData?.currentRoute?.points) {
      setPoints(teamData.currentRoute.points);
    }

    // Get current point after potential index update
    const currentPoint = points?.[finalPointIndex];
    const hasAnsweredCorrectly = teamData.visitedPoints?.includes(currentPoint?._id);
    
    // Show question in these cases:
    // 1. Not answered correctly yet
    // 2. Not in penalty
    // 3. Not already showing question
    if (!hasAnsweredCorrectly && !teamData.penaltyEndTime && !showQuestion) {
      setShowQuestion(true);
    }
    
    // Check for hints
    if (teamData?.hintRequested) {
      if (teamData.hintRequested.pointIndex === finalPointIndex) {
        setCurrentHintLevel(teamData.hintRequested.hintLevel);
      }
    }
    
    // Check for penalties
    if (teamData?.penaltyEndTime) {
      const penaltyEnd = new Date(teamData.penaltyEndTime);
      if (penaltyEnd > new Date()) {
        setPenaltyEndTime(penaltyEnd);
      }
    }

    // Update team state
    setTeam(updatedTeam);

    // Get completed points based on visitedPoints
    if (points) {
      const completed = points.filter(
        (point: Point) => updatedTeam.visitedPoints?.includes(point._id)
      );
      setCompletedPoints(completed);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!selectedAnswer || !team || !points) return;

    try {
      const currentPoint = points[team.currentPointIndex];
      const teamId = team.uniqueLink.split('/').pop() || team._id;
      
      console.log('Submitting answer:', {
        teamId,
        pointId: currentPoint._id,
        answer: selectedAnswer,
        currentPointIndex: team.currentPointIndex,
        visitedPoints: team.visitedPoints,
        attempts: team?.attempts || 0
      });
      
      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          pointId: currentPoint._id,
          answer: selectedAnswer,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error submitting answer:', { status: response.status, data });
        setMessage(data.message || 'שגיאה בשליחת התשובה');
        return;
      }

      if (data.correct) {
        // Reset states after correct answer
        setSelectedAnswer('');
        setCurrentHintLevel(0);
        setShowQuestion(false);
        setDisabledOptions([]);
        
        // Check if this was the last point
        const isLastPoint = team.currentPointIndex === points.length - 1;
        
        if (isLastPoint) {
          setMessage('כל הכבוד! רוץ לנקודת הסיום ולחץ על כפתור "עצור שעון"');
        } else {
          // Get the name of the next point to show in the message
          const nextPointIndex = team.currentPointIndex + 1;
          const nextPointName = points[nextPointIndex]?.name || 'הבאה';
          // Include the correct answer in the message
          setMessage(`צדקת! "${selectedAnswer}" - רוץ לנקודה ${nextPointName}`);
        }
        
        // When server API returns a team object with updates,
        // we should use that to update our local state
        if (data.team) {
          setTeam(data.team);
          // Update completed points based on server data
          if (data.team.visitedPoints && points) {
            const completed = points.filter(
              (point: Point) => data.team.visitedPoints.includes(point._id)
            );
            setCompletedPoints(completed);
          }
        } else {
          // Fallback to local state update
          const updatedTeam = {
            ...team,
            visitedPoints: [...(team.visitedPoints || []), currentPoint._id],
            attempts: 0
          };
          setTeam(updatedTeam);
          
          // Update completed points
          const completed = points.filter(
            (point: Point) => updatedTeam.visitedPoints.includes(point._id)
          );
          setCompletedPoints(completed);
        }
      } else {
        // Handle incorrect answer
        setMessage(data.message || 'טעית, נסה שוב');
        setDisabledOptions(prev => [...prev, selectedAnswer]);
        setSelectedAnswer('');
        
        // Update hint level based on attempts
        const newAttempts = (team.attempts || 0) + 1;
        if (newAttempts === 1) {
          setCurrentHintLevel(0); // Show zoom in image
        } else if (newAttempts === 2) {
          setCurrentHintLevel(1); // Show zoom out image
        } else if (newAttempts >= 3) {
          setCurrentHintLevel(2); // Show point name
        }
        
        // Handle penalty if applicable
        if (data.penaltyEndTime) {
          setPenaltyEndTime(new Date(data.penaltyEndTime));
          setMessage('נפסלתם! המתינו לסיום העונשין לקבלת הרמז הבא');
        }
        
        // Use server data if available
        if (data.team) {
          setTeam(data.team);
        } else {
          // Fallback to local update
          setTeam({
            ...team,
            attempts: newAttempts
          });
        }
      }
      
      // After submitting answer, fetch latest team data
      setTimeout(fetchTeam, 500);
      
    } catch (error) {
      console.error('Error in handleAnswerSubmit:', error);
      setMessage('שגיאה בשליחת התשובה');
    }
  };

  const handleRevealQuestion = async () => {
    if (!userLocation || !team) {
      setMessage('לא ניתן לאתר את מיקומך. אנא ודא שה-GPS מופעל.');
      return;
    }

    const currentPoint = getCurrentPoint();
    if (!currentPoint?.location) return;

    // Check distance to current point
    const distance = calculateDistance(userLocation, currentPoint.location);
    const maxDistanceKm = 0.05; // 50 meters
    
    if (distance > maxDistanceKm) {
      setMessage(`אתה נמצא במרחק ${Math.round(distance * 1000)} מטר מהנקודה. עליך להתקרב למרחק של עד 50 מטר כדי לענות על השאלה.`);
      return;
    }

    try {
      // If this is the final point and we've answered correctly, handle game completion
      const isLastPoint = team.currentPointIndex === points.length - 1;
      const hasAnsweredCorrectly = team.visitedPoints?.includes(currentPoint._id);

      if (isLastPoint && hasAnsweredCorrectly && !gameCompleted) {
        const capturedTime = elapsedTime;
        setFinalTime(capturedTime);
        setGameCompleted(true);
        setMessage(`כל הכבוד! סיימתם את המשחק! הזמן הסופי שלכם: ${formatTime(capturedTime)}`);
        
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Save completion time to server
        const teamId = team.uniqueLink.split('/').pop() || team._id;
        await fetch(`/api/game/${teamId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            completionTime: capturedTime,
            finalTime: capturedTime,
            completedAt: new Date().toISOString()
          }),
        });
        return;
      }

      // If we've answered correctly for the current point, move to next point
      if (hasAnsweredCorrectly) {
        const nextPointIndex = team.currentPointIndex + 1;
        if (nextPointIndex < points.length) {
          // Update local state
          const updatedTeam = {
            ...team,
            currentPointIndex: nextPointIndex,
            attempts: 0
          };
          
          // Update server state
          const teamId = team.uniqueLink.split('/').pop() || team._id;
          await updateServerPointIndex(nextPointIndex);
          
          // Update client state
          setTeam(updatedTeam);
          setShowQuestion(true);
          setMessage(null);
          
          console.log(`Advanced to point ${nextPointIndex}`);
          return;
        }
      }

      // Show question if we haven't already
      if (!showQuestion) {
        setShowQuestion(true);
        setMessage(null);
      }

    } catch (error) {
      console.error('Error in handleRevealQuestion:', error);
      setMessage('שגיאה בעדכון הנקודה');
    }
  };

  // Function to update the point index on the server
  const updateServerPointIndex = async (pointIndex: number) => {
    if (!team) return false;
    
    const teamId = team.uniqueLink.split('/').pop() || team._id;
    try {
      const response = await fetch(`/api/teams/${teamId}/update-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPointIndex: pointIndex
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update point on server:', await response.json());
        return false;
      }
      
      console.log('Successfully updated point index on server to:', pointIndex);
      return true;
    } catch (error) {
      console.error('Error updating point on server:', error);
      return false;
    }
  };

  const currentPoint = team && points.length > 0 ? points[team.currentPointIndex] : null;
  
  // Debugging: Log button text logic
  console.log('Button text:', isFinishPoint(currentPoint, points) && completedPoints.some(p => p._id === currentPoint?._id) 
    ? 'הגעתי! עצור את השעון!' 
    : 'הגעתי! חשוף שאלה');

  const getCurrentPoint = () => {
    if (!team || !points.length) return null;
    return points[team.currentPointIndex];
  };

  const getCurrentPointImage = () => {
    const currentPoint = getCurrentPoint();
    if (!currentPoint || !currentPoint.images) return null;
    
    // אם יש רמז רמה 1 או יותר, הצג תמונת זום אאוט
    if (currentHintLevel >= 1) {
      return currentPoint.images.zoomOut;
    }
    
    // אחרת הצג תמונת זום אין
    return currentPoint.images.zoomIn;
  };

  // Add global debug functions
  useEffect(() => {
    // Function to set GPS location manually
    window.setGPS = (lat: number, lng: number) => {
      console.log(`Setting GPS coordinates to: ${lat}, ${lng}`);
      setUserLocation([lat, lng]);
    };

    // Function to print current game state
    window.debugState = () => {
      const currentPoint = team?.currentRoute?.points[team?.currentPointIndex || 0];
      console.log('Current Game State:', {
        team: {
          name: team?.name,
          currentPointIndex: team?.currentPointIndex,
          visitedPoints: team?.visitedPoints,
          attempts: team?.attempts,
          currentPoint
        },
        userLocation,
        showQuestion,
        message,
        timestamp: new Date().toISOString()
      });
    };

    // Cleanup
    return () => {
      delete window.setGPS;
      delete window.debugState;
    };
  }, [team, userLocation, showQuestion, message]);

  // Add debug logging for counter changes
  useEffect(() => {
    const currentPoint = team?.currentRoute?.points[team?.currentPointIndex || 0];
    console.log('Counter Debug:', {
      currentPointIndex: team?.currentPointIndex,
      visitedPoints: team?.visitedPoints?.length,
      attempts: team?.attempts,
      currentPoint: currentPoint?.name,
      timestamp: new Date().toISOString()
    });
  }, [team?.currentPointIndex, team?.visitedPoints, team?.attempts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // הוספת מידע דיאגנוסטי
  const debugInfo = {
    teamId: params.teamId,
    teamFound: !!team,
    hasRoute: team && !!team.currentRoute,
    hasPoints: team && team.currentRoute && team.currentRoute.points && team.currentRoute.points.length > 0,
    startTime: team?.startTime ? new Date(team.startTime).toISOString() : null,
    currentPointIndex: team?.currentPointIndex,
    visitedPoints: team?.visitedPoints?.length || 0,
  };

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">קבוצה לא נמצאה</h1>
          <p className="text-gray-600 mb-4">הקישור שהזנת אינו תקין</p>
          {message && (
            <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg text-red-800 text-sm mb-4">
              {message}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium mb-4"
          >
            נסה שוב
          </button>
          
          {/* מידע דיאגנוסטי */}
          <div className="mt-6 text-left text-xs bg-gray-100 p-3 rounded-lg overflow-auto max-h-60">
            <h3 className="font-bold mb-2">מידע דיאגנוסטי:</h3>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (!team.startTime) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">המתן להזנקה</h1>
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

  const isRouteCompleted = gameCompleted;
  
  if (isRouteCompleted) {
    return (
      <div className="flex flex-col h-screen">
        <div className="bg-white shadow-md p-2">
          <div className="text-center text-2xl font-bold">
            {formatTime(finalTime || elapsedTime)}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="text-center max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold mb-4">סיימתם את המסלול!</h1>
            <p className="text-xl text-gray-600 mb-4">כל הכבוד! השלמתם את כל הנקודות בהצלחה.</p>
            <div className="text-2xl font-bold mb-4 bg-green-50 p-4 rounded-lg text-green-800">
              זמן סופי: {formatTime(finalTime || elapsedTime)}
            </div>
            <p className="text-sm text-gray-500">תודה על השתתפותכם במשחק!</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if team has not started yet
  const teamNotStarted = team && !team.startTime;
  
  if (teamNotStarted) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="text-center max-w-md w-full bg-white rounded-lg shadow-lg p-4">
            <h1 className="text-2xl font-bold mb-2">ממתין להזנקה</h1>
            <p className="text-gray-600 mb-2">המתינו לאישור האדמין להתחלת המשחק</p>
            <div className="animate-pulse mt-4">
              <div className="h-10 bg-blue-100 rounded-full w-full"></div>
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

  console.log('Rendering game page with state:', {
    currentPointIndex: team?.currentPointIndex,
    visitedPoints: team?.visitedPoints,
    currentPoint,
    userLocation,
    completedPoints
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="h-3"></div>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg p-2 sticky top-0 z-10"
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

        <div className="flex-1 overflow-auto">
          <div className="p-3 space-y-3 max-w-lg mx-auto">
            {penaltyTimeLeft > 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl shadow-lg p-6 text-center"
              >
                <h2 className="text-2xl font-bold mb-3">נפסלתם!</h2>
                <p className="text-lg opacity-90">
                  המתינו {formatPenaltyTime(penaltyTimeLeft)} לקבלת הרמז הבא
                </p>
              </motion.div>
            ) : (
              <>
                {/* תמונת הנקודה */}
                {getCurrentPointImage() && showQuestion && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden"
                  >
                    <img 
                      src={getCurrentPointImage()} 
                      alt="תמונת הנקודה" 
                      className="w-full h-56 object-cover"
                      onClick={() => setShowPointImage(true)}
                    />
                    {currentHintLevel >= 2 && (
                      <div className="p-3 text-center font-bold text-lg">
                        {currentPoint?.name}
                      </div>
                    )}
                  </motion.div>
                )}
                
                {/* שאלה */}
                {showQuestion ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-lg p-3"
                  >
                    {currentPoint.question.image && (
                      <div className="mb-3 relative w-full">
                        <img 
                          src={currentPoint.question.image} 
                          alt="תמונת השאלה" 
                          className="w-2/5 mr-0 ml-auto max-h-[40vh] object-contain rounded-lg"
                          onClick={() => setShowPointImage(true)}
                        />
                      </div>
                    )}
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
                          className={`flex items-center px-2 py-1.5 rounded transition-all text-sm
                            ${disabledOptions.includes(option) 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                              : selectedAnswer === option 
                                ? 'bg-blue-50 border border-blue-500' 
                                : 'bg-gray-50 hover:bg-gray-100 border border-transparent cursor-pointer'}`}
                        >
                          <input
                            type="radio"
                            name="answer"
                            value={option}
                            checked={selectedAnswer === option}
                            onChange={(e) => setSelectedAnswer(e.target.value)}
                            disabled={disabledOptions.includes(option)}
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
                      שלח
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-lg p-4 text-center"
                  >
                    {/* כפתור הגעה לנקודה */}
                    <div className="grid place-items-center mt-2">
                      <button
                        onClick={handleRevealQuestion}
                        disabled={penaltyTimeLeft > 0}
                        className={`
                          ${isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id)
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                          }
                          rounded-full p-4 shadow-lg flex flex-col items-center justify-center transform active:scale-95 transition-all
                          disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed
                        `}
                      >
                        {isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id) ? (
                          <>
                            <span className="font-bold block">הגעתי! עצור את השעון!</span>
                            <small className="text-white/80">כל הנקודות הושלמו - סיים</small>
                          </>
                        ) : (
                          <span className="font-bold">הגעתי! חשוף שאלה</span>
                        )}
                      </button>
                      
                      {isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id) && (
                        <small className="mt-1 text-center text-green-600">
                          כל הנקודות הושלמו! לחץ על הכפתור לסיום
                        </small>
                      )}
                    </div>
                  </motion.div>
                )}
              </>
            )}

            {message && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => message.includes('נכון מאד') ? null : setMessage(null)}
                className={`border-r-4 p-3 rounded-lg text-sm cursor-pointer ${
                  message.includes('צדקת') || message.includes('נכון מאד')
                    ? 'bg-green-50 border-green-500 text-green-800' 
                    : message.includes('טעית') 
                      ? 'bg-red-50 border-red-500 text-red-800'
                      : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
              >
                {message}
                {(message.includes('צדקת') || message.includes('נכון מאד')) && (
                  <div className="mt-2 text-xs text-gray-500">
                    לחץ על "הגעתי" להמשך
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* רשימת נקודות שהושלמו בתחתית העמוד */}
        {completedPoints.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border-t border-gray-200 p-4"
          >
            <div className="max-w-lg mx-auto">
              <h3 className="font-bold text-sm mb-2 text-gray-700">תחנות שעברתם:</h3>
              <div className="flex flex-wrap gap-2">
                {completedPoints.map((point, index) => (
                  <div key={point._id} className="flex items-center bg-green-50 rounded-full px-3 py-1 text-sm">
                    <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-green-800">{point.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* תצוגת תמונה מוגדלת */}
        {showPointImage && getCurrentPointImage() && (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
            onClick={() => setShowPointImage(false)}
          >
            <img 
              src={getCurrentPointImage()} 
              alt="תמונת הנקודה" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {/* המשך מעקב מיקום ברקע */}
        {userLocation && (
          <div className="hidden">
            <Map 
              userLocation={userLocation}
              currentPoint={currentPoint?.location}
              visitedPoints={points
                .filter(point => team?.visitedPoints?.includes(point._id))
                .map(point => point.location)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
} 
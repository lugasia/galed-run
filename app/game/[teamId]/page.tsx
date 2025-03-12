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
  const [finalTime, setFinalTime] = useState<number | null>(null); // Store final time separately
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyEndTime, setPenaltyEndTime] = useState<Date | null>(null);
  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState<number>(0);
  const [currentHintLevel, setCurrentHintLevel] = useState(0); // 0 = אין רמז, 1 = זום אאוט, 2 = שם התחנה
  const [showPointImage, setShowPointImage] = useState(false);
  const [completedPoints, setCompletedPoints] = useState<Point[]>([]);
  const [disabledOptions, setDisabledOptions] = useState<string[]>([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null); // Reference to store the timer interval

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 10000); // Refresh every 10 seconds

    // Start GPS tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
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
    if (gameCompleted) {
      console.log('Game completed effect triggered');
      
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log('Timer stopped');
      }
      
      // If we have a final time, use it, otherwise use current elapsed time
      const timeToSave = finalTime !== null ? finalTime : elapsedTime;
      
      // Save completion time to server
      const teamId = team?.uniqueLink.split('/').pop() || team?._id;
      if (teamId) {
        console.log('Saving completion time to server:', timeToSave);
        fetch(`/api/teams/${teamId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            completionTime: timeToSave,
          }),
        }).then(response => {
          console.log('Completion time saved, response status:', response.status);
        }).catch(error => {
          console.error('Error in completion time response:', error);
        });
      }
    }
  }, [gameCompleted, finalTime, elapsedTime, team]);

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
          
          // אם זה הניסיון השלישי (אחרי עונשין שני), הצג הודעה לרוץ לנקודה הבאה
          if (team?.attempts >= 3) {
            setMessage('רוץ לנקודה הבאה');
            setShowQuestion(false); // הסתר את השאלה
          }
          
          clearInterval(interval);
        } else {
          setPenaltyTimeLeft(timeLeft);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [penaltyEndTime, team, setShowQuestion, setMessage, setCurrentHintLevel, setPenaltyTimeLeft, setPenaltyEndTime]);

  const fetchTeam = async () => {
    try {
      // נסה לקבל קבוצה לפי המזהה
      const response = await fetch(`/api/game/${params.teamId}`);
      
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
            const activeTeamsResponse = await fetch('/api/teams/active');
            
            if (activeTeamsResponse.ok) {
              const activeTeamsData = await activeTeamsResponse.json();
              
              if (activeTeamsData.teams && activeTeamsData.teams.length > 0) {
                console.log('Found active teams:', activeTeamsData.teams);
                
                // השתמש בקבוצה הראשונה שנמצאה
                const firstActiveTeam = activeTeamsData.teams[0];
                console.log('Using first active team:', firstActiveTeam);
                
                // נסה לקבל את הקבוצה המלאה
                const teamResponse = await fetch(`/api/game/${firstActiveTeam._id}`);
                
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
          setMessage('קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
        }
        
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      // שמור את המידע הדיאגנוסטי
      if (data.debug) {
        console.log('Debug info:', data.debug);
        window.debugInfo = data.debug;
      }
      
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
  const processTeamData = (team: Team) => {
    if (team?.currentRoute?.points) {
      setPoints(team.currentRoute.points);
      
      // Update completed points list
      if (team.visitedPoints && team.visitedPoints.length > 0) {
        const completed = team.currentRoute.points.filter(
          (point: Point) => team.visitedPoints.includes(point._id)
        );
        setCompletedPoints(completed);
      }
    }
    
    // בנקודה הראשונה (אינדקס 0) הצג את השאלה אוטומטית
    // בשאר הנקודות המשתמש צריך ללחוץ על כפתור "הגעתי" כדי לראות את השאלה
    if (team.currentPointIndex === 0) {
      setShowQuestion(true);
    } else if (!team.penaltyEndTime && !showQuestion) { // Only reset if not in penalty and not already showing
      setShowQuestion(false);
    }
    
    // בדוק אם יש לקבוצה רמז פעיל
    if (team?.hintRequested) {
      // וודא שהרמז הוא עבור הנקודה הנוכחית
      if (team.hintRequested.pointIndex === team.currentPointIndex) {
        setCurrentHintLevel(team.hintRequested.hintLevel);
      }
    }
    
    // Check if team has a penalty
    if (team?.penaltyEndTime) {
      const penaltyEnd = new Date(team.penaltyEndTime);
      if (penaltyEnd > new Date()) {
        setPenaltyEndTime(penaltyEnd);
      }
    }
  };

  const handleAnswerSubmit = async () => {
    if (!selectedAnswer || !team || !points) return;

    try {
      const currentPoint = points[team.currentPointIndex];
      
      // Extract teamId from uniqueLink
      const teamId = team.uniqueLink.split('/').pop() || team._id;
      
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
        setMessage(data.message || 'שגיאה בשליחת התשובה');
        return;
      }

      if (data.correct) {
        // תשובה נכונה
        console.log('Correct answer debug:', {
            pointId: currentPoint._id,
            pointCode: currentPoint.code,
            isFinishPoint: currentPoint.isFinishPoint,
            teamId: team._id,
            visitedPointsBefore: team.visitedPoints
        });

        setSelectedAnswer('');
        setCurrentHintLevel(0); // איפוס רמת הרמז
        setShowQuestion(false); // הסתר את השאלה אחרי תשובה נכונה
        setDisabledOptions([]); // איפוס האפשרויות החסומות
        
        // Check if this is the pub point
        if (currentPoint.code === '1011' || currentPoint.isFinishPoint) {
            setMessage('נכון מאד! רוץ לפאב');
        } else {
            setMessage(`צדקת! רוץ לנקודה "${currentPoint.name}"`);
        }
        
        // רענן את נתוני הקבוצה
        await fetchTeam();
      } else {
        // תשובה שגויה
        setMessage('טעית, נסה שוב');
        
        // הוסף את התשובה השגויה לרשימת האפשרויות החסומות
        setDisabledOptions(prev => [...prev, selectedAnswer]);
        
        setSelectedAnswer('');
        
        // בדוק אם התקבל רמז אוטומטי מהשרת
        if (data.hintRequested && data.hintLevel !== undefined) {
          setCurrentHintLevel(data.hintLevel);
        }
        
        // בדוק אם יש עונש זמן
        if (data.penaltyEndTime) {
          setPenaltyEndTime(new Date(data.penaltyEndTime));
        }
        
        // רענן את נתוני הקבוצה
        await fetchTeam();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setMessage('שגיאה בשליחת התשובה');
    }
  };

  const handleRevealQuestion = async () => {
    // Check if this is the final point (Pub) and the question has been answered correctly
    const isFinalPoint = currentPoint?.code === '1011' || currentPoint?.isFinishPoint;
    const hasAnsweredCorrectly = team?.visitedPoints?.includes(currentPoint?._id);

    // Debug logs
    console.log('Game completion debug:', {
        isFinalPoint,
        currentPointCode: currentPoint?.code,
        isFinishPoint: currentPoint?.isFinishPoint,
        hasAnsweredCorrectly,
        currentPointId: currentPoint?._id,
        visitedPoints: team?.visitedPoints,
        teamId: team?._id,
        currentPointIndex: team?.currentPointIndex,
        totalPoints: points?.length
    });

    if (isFinalPoint && hasAnsweredCorrectly) {
        console.log('Final point conditions met, completing game');
        
        // Capture the final time
        const capturedTime = elapsedTime;
        console.log('Final time captured:', capturedTime);
        
        // Store the final time
        setFinalTime(capturedTime);
        
        // Stop the timer immediately
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            console.log('Timer stopped');
        }
        
        // Mark the game as completed
        setGameCompleted(true);
        
        // Create a game completion event
        try {
            // Extract teamId from uniqueLink or use _id as fallback
            const teamId = team?.uniqueLink?.split('/').pop() || team?._id;
            console.log('Using teamId for completion:', teamId);
            
            const response = await fetch(`/api/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    team: teamId,
                    type: 'ROUTE_COMPLETED',
                    point: currentPoint?._id,
                    details: {
                        finalTime: capturedTime,
                        completedAt: new Date().toISOString()
                    }
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create completion event');
            }
            
            console.log('Game completion event created successfully');
            
            // Update the message to show completion
            setMessage('כל הכבוד! סיימתם את המשחק!');
        } catch (error) {
            console.error('Error creating completion event:', error);
            setMessage('שגיאה בשמירת זמן הסיום. אנא צרו קשר עם מנהל המשחק.');
        }
        
        return; // Don't proceed to show the question
    }
    
    // For all other points, show the question and only clear message if not at final point
    setShowQuestion(true);
    if (!isFinalPoint) {
        setMessage(null);
    }
  };

  const currentPoint = team && points.length > 0 ? points[team.currentPointIndex] : null;
  
  const isFinishPoint = currentPoint?.code === '1011' || currentPoint?.isFinishPoint;
  
  // Debugging: Log button text logic
  console.log('Button text:', isFinishPoint && completedPoints.some(p => p._id === currentPoint?._id) 
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

  const isRouteCompleted = gameCompleted || (team?.currentPointIndex >= points.length);
  
  if (isRouteCompleted) {
    return (
      <div className="flex flex-col h-screen">
        <div className="bg-white shadow-md p-2">
          <div className="text-center text-2xl font-bold">
            {formatTime(finalTime !== null ? finalTime : elapsedTime)}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="text-center max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold mb-4">סיימתם את המסלול!</h1>
            <p className="text-xl text-gray-600 mb-4">כל הכבוד! השלמתם את כל הנקודות בהצלחה.</p>
            <div className="text-2xl font-bold mb-4 bg-green-50 p-4 rounded-lg text-green-800">
              זמן סופי: {formatTime(finalTime !== null ? finalTime : elapsedTime)}
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

  return (
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
                        className="w-full max-h-[40vh] object-contain rounded-lg"
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
                  <h2 className="text-xl font-bold mb-2">
                    הגעתם לנקודה?
                  </h2>
                  <p className="text-gray-600 mb-3">
                    {isFinishPoint && team?.visitedPoints?.includes(currentPoint?._id)
                        ? 'לחץ על הכפתור לסיום המשחק' 
                        : 'לחץ על הכפתור כדי לחשוף את השאלה'}
                  </p>
                  <button
                    onClick={handleRevealQuestion}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-4 rounded-lg font-medium
                        transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isFinishPoint && team?.visitedPoints?.includes(currentPoint?._id)
                        ? 'הגעתי! סיים את המשחק' 
                        : 'הגעתי! חשוף שאלה'}
                  </button>
                </motion.div>
              )}
            </>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border-r-4 p-3 rounded-lg text-sm ${
                message.includes('צדקת') 
                  ? 'bg-green-50 border-green-500 text-green-800' 
                  : message.includes('טעית') 
                    ? 'bg-red-50 border-red-500 text-red-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}
            >
              {message}
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
            currentPoint={currentPoint ? currentPoint.location : undefined}
            visitedPoints={team.visitedPoints.map(id => {
              const point = points.find(p => p._id === id);
              return point ? point.location : undefined;
            }).filter(Boolean) as [number, number][]}
          />
        </div>
      )}
    </div>
  );
} 
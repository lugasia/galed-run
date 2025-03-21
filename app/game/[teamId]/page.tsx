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
  const [answerCorrectButNotCompleted, setAnswerCorrectButNotCompleted] = useState<boolean>(false);
  const [gameCompletionReported, setGameCompletionReported] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef<boolean>(false);

  // פונקציה לחילוץ מזהה הקבוצה מהפרמטרים
  const getTeamId = () => {
    return params.teamId;
  };

  // פונקציה לחישוב הזמן שחלף בין שני תאריכים במילישניות
  const getElapsedTimeBetweenDates = (startDate: Date, endDate: Date): number => {
    if (!startDate || !endDate) return 0;
    return endDate.getTime() - startDate.getTime();
  };

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
    if (gameCompleted && finalTime !== null && !gameCompletionReported) {
      console.log('Game completed effect triggered, finalTime:', finalTime, 'reportingState:', gameCompletionReported);
      
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
        
        // סמן שכבר דיווחנו על סיום המשחק כדי למנוע קריאה כפולה
        setGameCompletionReported(true);
        
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
          // במקרה של שגיאה, נאפס את הדגל כדי לאפשר ניסיון נוסף
          setGameCompletionReported(false);
        });
      }
    }
  }, [gameCompleted, finalTime, team, gameCompletionReported]);

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

  // Add effect to prevent refresh
  useEffect(() => {
    // Check localStorage on component mount to see if user was in middle of point completion
    const savedAnswerState = localStorage.getItem(`correct_answer_${params.teamId}_${team?.currentPointIndex}`);
    if (savedAnswerState === 'true' && team && !gameCompleted) {
      const currentPoint = points?.[team.currentPointIndex];
      const hasVisitedCurrentPoint = currentPoint && team.visitedPoints?.includes(currentPoint._id);
      
      if (!hasVisitedCurrentPoint) {
        setAnswerCorrectButNotCompleted(true);
        setMessage('ענית נכון על השאלה! התקדם לנקודה הבאה.');
        setShowQuestion(false);
      }
    }
    
    // Add beforeunload event listener
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (answerCorrectButNotCompleted) {
        const message = 'האם אתה בטוח שברצונך לרענן את הדף? ייתכן שתצטרך לענות שוב על השאלה.';
        e.returnValue = message;
        return message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [params.teamId, team, points, answerCorrectButNotCompleted, gameCompleted]);

  const fetchTeam = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    try {
      const teamId = getTeamId();
      console.log('Fetching team data for teamId:', teamId);
      
      if (!teamId) {
        setMessage('לא סופק מזהה קבוצה. אנא בדוק את הקישור.');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
      
      const response = await fetch(`/api/game/${teamId}`, {
        // Add cache control to ensure fresh data
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          
          if (response.status === 404) {
            if (errorData?.debug?.teamFound === false) {
              setMessage('קבוצה לא נמצאה. בדוק שהקישור שהזנת נכון.');
            } else if (errorData?.debug?.hasRoute === false) {
              setMessage('לא נמצא מסלול לקבוצה. אנא פנה למנהל המערכת.');
            } else {
              setMessage('משאב לא נמצא. בדוק את הקישור שהזנת.');
            }
          } else if (response.status === 401 || response.status === 403) {
            setMessage('אין לך הרשאה לצפות בדף זה. בדוק את הקישור או פנה למנהל המערכת.');
          } else if (response.status >= 500) {
            setMessage('שגיאת שרת. אנא נסה שוב עוד מספר דקות או פנה למנהל המערכת.');
            // ניסיון מחדש אוטומטי עבור שגיאות שרת
            setTimeout(() => {
              console.log('Retrying after server error...');
              fetchingRef.current = false;
              fetchTeam();
            }, 5000); // נסה שוב אחרי 5 שניות
            return;
          } else {
            setMessage(errorData.message || 'קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
          }
          
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          setMessage('קבוצה לא נמצאה. בדוק את הקישור שהזנת.');
        }
        
        setLoading(false);
        fetchingRef.current = false;
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
        fetchingRef.current = false;
        return;
      }
      
      setTeam(data.team);
      processTeamData(data.team);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team:', error);
      
      // בדיקה אם השגיאה היא בעיית רשת
      if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
        setMessage('נראה שיש בעיית חיבור לאינטרנט. בדוק את החיבור שלך ונסה שוב.');
        
        // ניסיון מחדש אוטומטי עבור בעיות רשת
        setTimeout(() => {
          console.log('Retrying due to network error...');
          fetchingRef.current = false;
          fetchTeam();
        }, 3000); // נסה שוב אחרי 3 שניות
      } else {
        setMessage('שגיאה בטעינת נתוני הקבוצה. נסה לרענן את העמוד או לפנות למנהל המערכת.');
      }
      
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  };
  
  // פונקציה לעיבוד נתוני הקבוצה
  const processTeamData = (teamData: any) => {
    if (!teamData) {
      console.error('processTeamData called with null or undefined data');
      return;
    }

    console.log('processTeamData debug:', {
      serverPointIndex: teamData.currentPointIndex,
      totalPoints: points?.length,
      visitedPoints: teamData.visitedPoints || [],
      isRouteCompleted: teamData.currentRoute?.isCompleted,
      gameCompleted: teamData.gameCompleted,
    });

    // בדיקה שיש לנו נקודות
    if (!points || points.length === 0) {
      if (teamData.currentRoute?.points) {
        setPoints(teamData.currentRoute.points);
      } else {
        console.error('No points available in team data');
        setMessage('אין נקודות במסלול. נא לפנות למנהל המערכת.');
        return;
      }
    }

    // Use local state if it's ahead of server state (to prevent rollback)
    const localIndex = team?.currentPointIndex || 0;
    const serverIndex = teamData.currentPointIndex || 0;
    
    // אם המשחק כבר הסתיים, השתמש בנתונים מהשרת
    if (teamData.gameCompleted) {
      setGameCompleted(true);
      // אם המשחק כבר הסתיים לפי נתוני השרת, סימן שהדיווח כבר נעשה
      setGameCompletionReported(true);
      
      const finalTime = getElapsedTimeBetweenDates(
        new Date(teamData.startTime),
        new Date(teamData.finishTime)
      );
      setFinalTime(finalTime);
      
      // הצג הודעת סיום משחק
      setMessage(`כל הכבוד! סיימתם את המשחק! הזמן הסופי שלכם: ${formatTime(finalTime)}`);
      
      // עצור את הטיימר
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // בדיקה עבור מצב של עונשין
    if (teamData.penaltyEndTime) {
      const penaltyEnd = new Date(teamData.penaltyEndTime);
      if (penaltyEnd > new Date()) {
        setPenaltyEndTime(penaltyEnd);
        // שמור על הצגת הודעת עונשין מתאימה
        const timeLeftMs = penaltyEnd.getTime() - Date.now();
        const timeLeftSec = Math.ceil(timeLeftMs / 1000);
        setMessage(`יש לך עונשין! עליך להמתין ${timeLeftSec} שניות לקבלת הרמז הבא.`);
      } else {
        // העונשין הסתיים
        setPenaltyEndTime(undefined);
      }
    }

    // If we have local state and it's ahead of the server, use it
    // אבל רק אם המשחק עדיין לא הסתיים
    const useLocalIndex = !teamData.gameCompleted && localIndex > serverIndex;
    
    // Final point index to use, prioritizing local progress
    const finalPointIndex = useLocalIndex ? localIndex : serverIndex;
    
    console.log('Progress preservation:', {
      localIndex,
      serverIndex,
      useLocalIndex,
      finalPointIndex,
      gameCompleted: teamData.gameCompleted
    });

    // Update team with the correct point index
    const updatedTeam = {
      ...teamData,
      currentPointIndex: finalPointIndex,
    };

    // הגדר את הקבוצה המעודכנת
    setTeam(updatedTeam);

    // Get current point after potential index update
    const currentPoint = points?.[finalPointIndex];
    if (!currentPoint) {
      console.error('Current point not found at index:', finalPointIndex);
      return;
    }
    
    const hasAnsweredCorrectly = teamData.visitedPoints?.includes(currentPoint._id);
    
    // Show question in these cases:
    // 1. Not answered correctly yet
    // 2. Not in penalty
    // 3. Not already showing question
    // 4. Game is not completed
    if (!hasAnsweredCorrectly && !teamData.penaltyEndTime && !showQuestion && !teamData.gameCompleted) {
      setShowQuestion(true);
    }
    
    // Check for hints
    if (teamData?.hintRequested) {
      if (teamData.hintRequested.pointIndex === finalPointIndex) {
        setCurrentHintLevel(teamData.hintRequested.hintLevel);
      }
    }
    
    // Get completed points based on visitedPoints
    if (points) {
      const completed = points.filter(
        (point: Point) => teamData.visitedPoints?.includes(point._id)
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
        // Check if this is a point that was already completed (to handle refresh case)
        if (data.alreadyCompleted) {
          setMessage(data.message || 'כבר ענית נכון על שאלה זו!');
          setSelectedAnswer('');
          setCurrentHintLevel(0);
          setShowQuestion(false);
          setDisabledOptions([]);
          
          // Make sure our local state matches the server state
          if (data.team) {
            setTeam(data.team);
            
            // Update completed points based on server data
            if (data.team.visitedPoints && points) {
              const completed = points.filter(
                (point: Point) => data.team.visitedPoints.includes(point._id)
              );
              setCompletedPoints(completed);
            }
          }
          
          return;
        }
        
        // Reset states after correct answer
        setSelectedAnswer('');
        setCurrentHintLevel(0);
        setShowQuestion(false);
        setDisabledOptions([]);
        
        // Set the flag that user answered correctly but may not have completed the checkpoint
        setAnswerCorrectButNotCompleted(true);
        
        // Save this state to localStorage in case of refresh
        localStorage.setItem(`correct_answer_${params.teamId}_${team.currentPointIndex}`, 'true');
        
        // Check if this was the last point
        const isLastPoint = team.currentPointIndex === points.length - 1;
        
        if (isLastPoint) {
          setMessage('כל הכבוד! רוץ לנקודת הסיום ולחץ על כפתור "עצור שעון"');
        } else {
          // Get the name of the CURRENT point (not the next one)
          const currentPointName = currentPoint?.name || 'הנוכחית';
          // Include the correct answer in the message
          setMessage(`צדקת! "${selectedAnswer}" - רוץ לנקודה ${currentPointName}`);
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

        // אין צורך לקרוא כאן ל-API - האפקט יטפל בזה
        // כך נמנע כפילות
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

  // Add function to update state when user completes checkpoint
  const handlePointCompleted = () => {
    // Clear the localStorage flag for this point
    if (team) {
      localStorage.removeItem(`correct_answer_${params.teamId}_${team.currentPointIndex}`);
      setAnswerCorrectButNotCompleted(false);
    }
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

  const isRouteCompleted = gameCompleted;
  
  if (isRouteCompleted) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="bg-white shadow-md p-6 sticky top-0 z-10">
          <div className="flex items-center justify-center">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-2 rounded-full font-mono text-2xl shadow-md">
              {formatTime(finalTime || elapsedTime)}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden"
          >
            {/* Confetti background effect */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-100 rounded-full opacity-50"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-100 rounded-full opacity-50"></div>
            
            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="bg-green-100 p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                סיימתם את המסלול!
              </h1>
              
              <p className="text-xl text-gray-600 mb-6 text-center">
                כל הכבוד! השלמתם את כל הנקודות בהצלחה.
              </p>
              
              <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-xl border border-green-200 mb-6 shadow-inner">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">זמן סופי</div>
                  <div className="text-3xl font-bold font-mono text-green-700">
                    {formatTime(finalTime || elapsedTime)}
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500">תודה על השתתפותכם במשחק!</p>
                <div className="flex justify-center mt-3 space-x-1 rtl:space-x-reverse">
                  <span className="text-yellow-500">★</span>
                  <span className="text-yellow-500">★</span>
                  <span className="text-yellow-500">★</span>
                  <span className="text-yellow-500">★</span>
                  <span className="text-yellow-500">★</span>
                </div>
              </div>
            </div>
          </motion.div>
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
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col h-screen bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4 sticky top-0 z-10"
        >
          <div className="relative overflow-hidden">
            {/* גרדיאנט רקע דקורטיבי */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-400/30"></div>
            
            {/* תוכן השעון והמידע */}
            <div className="relative px-6 py-4 z-10">
              <div className="flex flex-col items-center">
                <h1 className="text-xl font-bold text-gray-800 mb-1">{team.name}</h1>
                
                {/* השעון המרכזי */}
                <div className="bg-white/70 backdrop-blur-sm px-8 py-2 rounded-full mb-2 shadow-md border border-gray-100">
                  <div className="text-3xl font-mono font-bold tracking-wider bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
                
                {/* מידע נוסף */}
                <div className="flex items-center justify-center gap-3 mt-1">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium shadow-sm">
                    נקודה {team?.currentPointIndex + 1} מתוך {points.length}
                  </span>
                  {penaltyTimeLeft > 0 && (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium shadow-sm animate-pulse">
                      עונש: {formatPenaltyTime(penaltyTimeLeft)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 overflow-auto">
          <div className="p-3 space-y-3 max-w-lg mx-auto">
            {penaltyTimeLeft > 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg"
              >
                <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-white/20 p-2 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-white font-mono text-xl px-4 py-1 bg-white/10 backdrop-blur-sm rounded-full">
                      {formatPenaltyTime(penaltyTimeLeft)}
                    </div>
                  </div>
                </div>
                
                <div className="p-6 text-center">
                  <h2 className="text-2xl font-bold mb-3 text-red-600">נפסלתם!</h2>
                  <p className="text-gray-700">
                    המתינו לסיום העונשין לקבלת הרמז הבא
                  </p>
                </div>
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
                    className="bg-white rounded-2xl shadow-lg p-5"
                  >
                    {currentPoint.question.image && (
                      <div className="mb-4 relative w-full">
                        <img 
                          src={currentPoint.question.image} 
                          alt="תמונת השאלה" 
                          className="w-2/5 mr-0 ml-auto max-h-[40vh] object-contain rounded-xl shadow-md"
                          onClick={() => setShowPointImage(true)}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h2 className="text-lg font-bold flex-1 leading-tight text-gray-800">{currentPoint.question.text}</h2>
                    </div>
                    <div className="space-y-2 mt-4">
                      {currentPoint.question.options.map((option, index) => (
                        <label 
                          key={index} 
                          className={`flex items-center px-3 py-2.5 rounded-xl transition-all text-sm
                            ${disabledOptions.includes(option) 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                              : selectedAnswer === option 
                                ? 'bg-blue-50 border-2 border-blue-400 shadow-md' 
                                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 cursor-pointer'}`}
                        >
                          <input
                            type="radio"
                            name="answer"
                            value={option}
                            checked={selectedAnswer === option}
                            onChange={(e) => setSelectedAnswer(e.target.value)}
                            disabled={disabledOptions.includes(option)}
                            className="w-4 h-4 text-blue-600 mr-3 cursor-pointer"
                          />
                          <span className="text-base">{option}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handleAnswerSubmit}
                      disabled={!selectedAnswer}
                      className="mt-5 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl text-base font-medium
                        disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-60 
                        transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
                    >
                      שלח תשובה
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-lg p-5 text-center"
                  >
                    {/* כפתור הגעה לנקודה */}
                    <div className="grid place-items-center mt-2">
                      <button
                        onClick={handleRevealQuestion}
                        disabled={penaltyTimeLeft > 0}
                        className={`
                          ${isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id)
                            ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                            : 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                          }
                          rounded-full p-5 shadow-lg flex flex-col items-center justify-center transform active:scale-95 transition-all
                          disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-60 disabled:cursor-not-allowed
                          w-32 h-32
                        `}
                      >
                        {isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id) ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-bold block">הגעתי!</span>
                            <span className="text-xs">עצור את השעון</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-bold block">הגעתי!</span>
                            <span className="text-xs">חשוף שאלה</span>
                          </>
                        )}
                      </button>
                      
                      {isFinishPoint(currentPoint, points) && team?.visitedPoints?.includes(currentPoint?._id) && (
                        <small className="mt-3 text-center text-green-600 font-medium">
                          רוץ לנקודה {currentPoint?.name || 'הסיום'}
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
                className={`border-r-4 p-4 rounded-xl text-base cursor-pointer shadow-md ${
                  message.includes('צדקת') || message.includes('נכון מאד')
                    ? 'bg-green-50 border-green-500 text-green-800' 
                    : message.includes('טעית') 
                      ? 'bg-red-50 border-red-500 text-red-800'
                      : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
              >
                {message}
                {(message.includes('צדקת') || message.includes('נכון מאד')) && (
                  <div className="mt-2 text-sm text-gray-600">
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
            className="bg-white rounded-2xl shadow-lg p-5 mb-4"
          >
            <div className="max-w-lg mx-auto">
              <div className="flex items-center mb-3">
                <div className="bg-green-100 p-1.5 rounded-full mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-base text-gray-700">תחנות שעברתם:</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {completedPoints.map((point, index) => (
                  <div key={point._id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-3 py-2 text-sm shadow-sm">
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-2 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-green-800 font-medium truncate">{point.name}</span>
                    </div>
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
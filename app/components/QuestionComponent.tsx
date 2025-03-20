import React, { useEffect } from 'react';

const QuestionComponent: React.FC = () => {
  const isCorrectAnswer = true; // Replace with actual logic
  const isPointVisitCompleted = true; // Replace with actual logic

  useEffect(() => {
    // Add beforeunload event listener to warn before refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if user has answered correctly but not completed the point visit
      if (isCorrectAnswer && !isPointVisitCompleted) {
        // The message text isn't actually shown in modern browsers for security reasons
        // But we need to set a return value to trigger the dialog
        const message = "האם אתה בטוח שברצונך לעזוב את הדף? התקדמותך עשויה להימחק.";
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isCorrectAnswer, isPointVisitCompleted]);

  return (
    // Rest of the component code
  );
};

export default QuestionComponent; 
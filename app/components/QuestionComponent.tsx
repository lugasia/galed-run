import React, { useEffect } from 'react';

interface QuestionComponentProps {
  isCorrectAnswer: boolean;
  isPointVisitCompleted: boolean;
}

const QuestionComponent: React.FC<QuestionComponentProps> = ({ 
  isCorrectAnswer = false, 
  isPointVisitCompleted = false 
}) => {
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
    <div className="warning-container">
      {isCorrectAnswer && !isPointVisitCompleted && (
        <div className="warning-message">
          שים לב: אם תרענן את הדף כעת, ייתכן שתצטרך לענות על השאלה שוב.
        </div>
      )}
    </div>
  );
};

export default QuestionComponent; 
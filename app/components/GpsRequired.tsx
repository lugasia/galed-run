'use client';

import React from 'react';

interface GpsRequiredProps {
  error?: string;
}

const GpsRequired: React.FC<GpsRequiredProps> = ({ error }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">נדרש מיקום GPS</h1>
        <p className="text-gray-600 mb-4">
          כדי להשתתף במשחק, אנא אפשר גישה למיקום שלך
        </p>
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
            {error}
          </div>
        )}
        <div className="animate-bounce text-6xl mb-4">📍</div>
        <p className="text-sm text-gray-500">
          אם חסמת את הגישה למיקום, תוכל לאפשר אותה מחדש בהגדרות הדפדפן
        </p>
      </div>
    </div>
  );
};

export default GpsRequired; 
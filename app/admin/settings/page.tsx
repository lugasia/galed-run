'use client';

import React, { useState, useEffect } from 'react';
import type { Point } from '../../types';

interface QuestionFormData {
  text: string;
  options: string[];
  correctAnswer: string;
}

export default function SettingsPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormData>({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '',
  });

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const response = await fetch('/api/points');
        if (!response.ok) {
          throw new Error('Failed to fetch points');
        }
        const data = await response.json();
        setPoints(data);
      } catch (error) {
        console.error('Error fetching points:', error);
      }
    };

    fetchPoints();
  }, []);

  const handlePointSelect = (point: Point) => {
    setSelectedPoint(point);
    if (point.question) {
      setQuestionForm({
        text: point.question.text,
        options: point.question.options,
        correctAnswer: point.question.correctAnswer,
      });
    } else {
      setQuestionForm({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: '',
      });
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoint) return;

    try {
      const response = await fetch(`/api/points/${selectedPoint._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...selectedPoint,
          question: questionForm,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update point');
      }

      const updatedPoint = await response.json();
      setPoints((prevPoints) =>
        prevPoints.map((p) => (p._id === updatedPoint._id ? updatedPoint : p))
      );
      alert('השאלה נשמרה בהצלחה');
    } catch (error) {
      console.error('Error updating point:', error);
      alert('שגיאה בשמירת השאלה');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">ניהול שאלות</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <h2 className="text-lg font-semibold mb-4">נקודות</h2>
              <div className="space-y-2">
                {points.map((point) => (
                  <div
                    key={point._id}
                    className={`p-3 border rounded cursor-pointer ${
                      selectedPoint?._id === point._id
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handlePointSelect(point)}
                  >
                    <div className="font-medium">{point.name}</div>
                    <div className="text-sm text-gray-500">קוד: {point.code}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              {selectedPoint ? (
                <form onSubmit={handleSubmit}>
                  <h2 className="text-lg font-semibold mb-4">
                    עריכת שאלה: {selectedPoint.name}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        שאלה
                      </label>
                      <textarea
                        value={questionForm.text}
                        onChange={(e) =>
                          setQuestionForm({ ...questionForm, text: e.target.value })
                        }
                        className="w-full p-2 border rounded"
                        rows={3}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        אפשרויות תשובה
                      </label>
                      {questionForm.options.map((option, index) => (
                        <div key={index} className="mb-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => handleOptionChange(index, e.target.value)}
                              className="flex-1 p-2 border rounded"
                              placeholder={`אפשרות ${index + 1}`}
                              required
                            />
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={questionForm.correctAnswer === option}
                              onChange={() =>
                                setQuestionForm({ ...questionForm, correctAnswer: option })
                              }
                              className="mt-3"
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
                        שמירה
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  בחר נקודה כדי לערוך את השאלה שלה
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
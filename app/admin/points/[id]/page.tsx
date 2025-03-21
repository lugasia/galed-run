'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Point } from '@/models/Point';

export default function PointForm({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isEditing = params.id !== 'new';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    location: { type: 'Point', coordinates: [0, 0] },
    question: '',
    options: [{ text: '', isCorrect: false }],
    hints: [{ text: '', cost: 0 }],
    image: '',
    qrCode: '',
    nextPointQrCode: ''
  });

  useEffect(() => {
    if (isEditing) {
      fetchPoint();
    }
  }, [isEditing]);

  const fetchPoint = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/points/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch point');
      const data = await response.json();
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנקודה');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const url = isEditing ? `/api/points/${params.id}` : '/api/points';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save point');
      }

      router.push('/admin/points');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הנקודה');
    } finally {
      setLoading(false);
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: '', isCorrect: false }],
    });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const addHint = () => {
    setFormData({
      ...formData,
      hints: [...formData.hints, { text: '', cost: 0 }],
    });
  };

  const removeHint = (index: number) => {
    setFormData({
      ...formData,
      hints: formData.hints.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return <div className="text-center">טוען...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        {isEditing ? 'עריכת נקודה' : 'יצירת נקודה חדשה'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            שם הנקודה
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            קוד QR של הנקודה
          </label>
          <input
            type="text"
            value={formData.qrCode}
            onChange={(e) => setFormData({ ...formData, qrCode: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
            placeholder="לדוגמה: POINT_001"
          />
          <p className="text-sm text-gray-500">
            קוד ייחודי שישמש לזיהוי הנקודה בסריקת QR
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            קוד QR של הנקודה הבאה
          </label>
          <input
            type="text"
            value={formData.nextPointQrCode}
            onChange={(e) => setFormData({ ...formData, nextPointQrCode: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="לדוגמה: POINT_002"
          />
          <p className="text-sm text-gray-500">
            קוד QR של הנקודה הבאה במסלול (אופציונלי)
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            שאלה
          </label>
          <textarea
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            תשובות אפשריות
          </label>
          {formData.options.map((option, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={option.text}
                onChange={(e) => {
                  const newOptions = [...formData.options];
                  newOptions[index] = { ...option, text: e.target.value };
                  setFormData({ ...formData, options: newOptions });
                }}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={`תשובה ${index + 1}`}
              />
              <label className="flex items-center">
                <input
                  type="radio"
                  name="correct"
                  checked={option.isCorrect}
                  onChange={() => {
                    const newOptions = formData.options.map((opt, i) => ({
                      ...opt,
                      isCorrect: i === index,
                    }));
                    setFormData({ ...formData, options: newOptions });
                  }}
                  className="ml-2"
                />
                נכון
              </label>
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-red-600 hover:text-red-800"
              >
                מחק
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-indigo-600 hover:text-indigo-800"
          >
            + הוסף תשובה
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            רמזים
          </label>
          {formData.hints.map((hint, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={hint.text}
                onChange={(e) => {
                  const newHints = [...formData.hints];
                  newHints[index] = { ...hint, text: e.target.value };
                  setFormData({ ...formData, hints: newHints });
                }}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={`רמז ${index + 1}`}
              />
              <input
                type="number"
                value={hint.cost}
                onChange={(e) => {
                  const newHints = [...formData.hints];
                  newHints[index] = { ...hint, cost: parseInt(e.target.value) };
                  setFormData({ ...formData, hints: newHints });
                }}
                className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="עלות"
              />
              <button
                type="button"
                onClick={() => removeHint(index)}
                className="text-red-600 hover:text-red-800"
              >
                מחק
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHint}
            className="mt-2 text-indigo-600 hover:text-indigo-800"
          >
            + הוסף רמז
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            תמונה (URL)
          </label>
          <input
            type="text"
            value={formData.image}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => router.push('/admin/points')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            disabled={loading}
          >
            {loading ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </form>
    </div>
  );
} 
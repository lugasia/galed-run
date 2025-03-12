'use client';

import React, { useState } from 'react';
import AdminNav from '../../components/AdminNav';

export default function ImportPage() {
  const [jsonData, setJsonData] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleImport = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      // Validate JSON format
      const data = JSON.parse(jsonData);
      
      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setMessage({
        type: 'success',
        text: `ייבוא הושלם בהצלחה! נוצרו ${result.created?.routes || 0} מסלולים ו-${result.created?.teams || 0} קבוצות.`
      });
      setJsonData('');
    } catch (error) {
      console.error('Import error:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'שגיאה בייבוא הנתונים'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <AdminNav />
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-4">ייבוא נתונים</h1>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">הוראות:</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>העתק את הנתונים מהאקסל</li>
                <li>המר אותם לפורמט JSON באמצעות כלי המרה אונליין (למשל: Excel to JSON converter)</li>
                <li>הדבק את ה-JSON בתיבת הטקסט למטה</li>
                <li>לחץ על כפתור "ייבא נתונים"</li>
              </ol>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                JSON נתונים
              </label>
              <textarea
                value={jsonData}
                onChange={(e) => setJsonData(e.target.value)}
                className="w-full h-64 p-3 border rounded-lg font-mono text-sm"
                placeholder="הדבק כאן את נתוני ה-JSON..."
                dir="ltr"
              />
            </div>

            {message && (
              <div className={`p-4 rounded-lg mb-4 ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message.text}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={loading || !jsonData.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium
                hover:bg-blue-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'מייבא...' : 'ייבא נתונים'}
            </button>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">מבנה ה-JSON הנדרש:</h2>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm" dir="ltr">
{`{
  "routes": [
    {
      "name": "שם המסלול",
      "points": [
        {
          "name": "שם הנקודה",
          "code": "1001",
          "location": [32.123, 34.123],
          "question": {
            "text": "שאלה?",
            "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
            "correctAnswer": "תשובה 1"
          }
        }
      ]
    }
  ],
  "teams": [
    {
      "name": "שם הקבוצה",
      "leaderName": "שם ראש הקבוצה",
      "routeName": "שם המסלול"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
} 
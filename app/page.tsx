'use client';

import React from 'react';
import Link from 'next/link';

const adminLinks = [
  { name: 'מסלולים', href: '/admin/routes', icon: '🛣️', description: 'יצירה וניהול מסלולים' },
  { name: 'מפה', href: '/admin/map', icon: '🗺️', description: 'מעקב GPS ונקודות עניין' },
  { name: 'קבוצות', href: '/admin/teams', icon: '👥', description: 'ניהול קבוצות המשתתפות' },
  { name: 'אירועים', href: '/admin/events', icon: '📅', description: 'יומן אירועים בזמן אמת' },
  { name: 'נקודות', href: '/admin/points', icon: '📍', description: 'ניהול נקודות ושאלות' },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">ברוכים הבאים לממשק הניהול</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 border border-gray-100"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 text-3xl">
                  {link.icon}
                </div>
                <div className="mr-4">
                  <h2 className="text-lg font-semibold text-gray-900">{link.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{link.description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 
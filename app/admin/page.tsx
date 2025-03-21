'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaRoute, FaUsers, FaCog, FaFileImport } from 'react-icons/fa';
import Link from 'next/link';

interface AdminCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  delay?: number;
}

const AdminCard = ({ title, description, icon, href, delay = 0 }: AdminCardProps) => (
  <Link href={href}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
    >
      <div className="flex items-start space-x-4 rtl:space-x-reverse">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>
      </div>
    </motion.div>
  </Link>
);

const adminActions = [
  {
    title: 'ניהול מסלולים',
    description: 'יצירה ועריכה של מסלולים וקביעת סדר הנקודות',
    icon: '🛣️',
    href: '/admin/routes'
  },
  {
    title: 'מפה ומעקב',
    description: 'צפייה במפה חיה ומעקב אחר התקדמות המשתתפים',
    icon: '🗺️',
    href: '/admin/map'
  },
  {
    title: 'ניהול קבוצות',
    description: 'ניהול קבוצות, משתתפים והרשאות',
    icon: '👥',
    href: '/admin/teams'
  },
  {
    title: 'מעקב בזמן אמת',
    description: 'צפייה באירועים ועדכונים בזמן אמת',
    icon: '⚡',
    href: '/admin/live'
  },
  {
    title: 'נקודות ושאלות',
    description: 'ניהול נקודות במסלול ושאלות המשחק',
    icon: '📍',
    href: '/admin/points'
  }
];

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            ברוכים הבאים לממשק הניהול
          </h1>
          <p className="text-gray-600 text-lg">
            בחר מהאפשרויות הבאות את הפעולה הרצויה
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action, index) => (
            <AdminCard
              key={action.title}
              {...action}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 
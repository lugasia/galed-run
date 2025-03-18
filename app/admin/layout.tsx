'use client';

import React from 'react'
import AdminNav from '../components/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminNav />
      <main className="flex-1 pr-64">
        {children}
      </main>
    </div>
  );
} 
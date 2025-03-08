'use client';

import React from 'react'
import Image from 'next/image'
import AdminNav from '../components/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center h-[50px] px-4">
          <div className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={80}
              height={40}
              priority
              style={{
                width: '80px',
                height: '40px',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      </header>
      <div className="mt-[50px]">
        <AdminNav />
        <main className="flex-1 bg-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
} 
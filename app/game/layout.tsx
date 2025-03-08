'use client';

import React from 'react'
import Image from 'next/image'

export default function GameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="h-5"></div>
      <header className="bg-white shadow-md">
        <div className="flex items-center justify-between h-90">
          <div className="text-center flex flex-col items-center w-full">
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={120}
              height={60}
              priority
              style={{
                width: '120px',
                height: '60px',
                objectFit: 'contain'
              }}
            />
            <h1 className="text-xl font-bold text-gray-900">ריצת ניווט גלעד</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-gray-100">
        <div className="container mx-auto px-4 py-0">
          <div className="bg-white rounded-lg shadow-lg px-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
} 
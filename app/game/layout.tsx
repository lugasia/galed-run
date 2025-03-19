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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md py-4">
        <div className="flex items-center justify-center">
          <div className="text-center flex flex-col items-center">
            <div className="relative w-full h-24 mb-2">
              <Image
                src="/images/logo.png"
                alt="Logo"
                fill
                priority
                style={{
                  objectFit: 'contain'
                }}
                className="drop-shadow-md"
              />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent mb-1">
              ריצת ניווט גלעד
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
          </div>
        </div>
      </div>
      <main className="flex-1 bg-gray-100">
        <div className="container mx-auto px-4 py-2">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {children}
          </div>
        </div>
      </main>
      
      {/* הודעת זכויות יוצרים - בתחתית העמוד מימין */}
      <footer className="py-4 px-4">
        <div className="flex justify-end">
          <div className="text-xs text-gray-600 font-medium py-1 px-2 bg-white/70 rounded-lg shadow-sm">
            <span className="mr-1 text-sm">©</span>
            <span>כל הזכויות שמורות - אמיר לוגסי</span>
          </div>
        </div>
      </footer>
    </div>
  )
} 
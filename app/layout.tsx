import React from 'react'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ניווט גלעד',
  description: 'משחק ניווט בקיבוץ גלעד',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen bg-gray-100">
          {children}
        </div>
      </body>
    </html>
  )
} 
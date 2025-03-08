'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const navItems = [
  { name: 'מסלולים', href: '/admin/routes', icon: '🛣️' },
  { name: 'מפה', href: '/admin/map', icon: '🗺️' },
  { name: 'קבוצות', href: '/admin/teams', icon: '👥' },
  { name: 'אירועים', href: '/admin/events', icon: '📅' },
  { name: 'נקודות', href: '/admin/points', icon: '📍' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-white shadow-lg fixed top-0 right-0 left-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link 
            href="/admin" 
            className="relative group"
          >
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ריצת ניווט גלעד
            </span>
            <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all group-hover:w-full"></span>
          </Link>
          <div className="flex space-x-1 rtl:space-x-reverse">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-200"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    }}
                    className="absolute inset-0 rounded-xl"
                  />
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative">{item.icon}</span>
                  <span 
                    className={`relative text-sm font-medium ${
                      isActive 
                        ? 'text-blue-600' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="active-dot"
                      className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </motion.nav>
  );
} 
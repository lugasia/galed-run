'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const navItems = [
  { name: 'נקודות', href: '/admin/points', icon: '📍' },
  { name: 'מסלולים', href: '/admin/routes', icon: '🛣️' },
  { name: 'קבוצות', href: '/admin/teams', icon: '👥' },
  { name: 'מפה', href: '/admin/map', icon: '🗺️' },
  { name: 'אירועים', href: '/admin/events', icon: '📅' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ x: 100 }}
      animate={{ x: 0 }}
      className="bg-white shadow-lg fixed top-0 right-0 bottom-0 w-64 z-50 flex flex-col"
    >
      <div className="p-4 border-b">
        <Link 
          href="/admin" 
          className="relative group block"
        >
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ריצת ניווט גלעד
          </span>
          <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transition-all group-hover:w-full"></span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200"
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
                    className="absolute inset-0 rounded-xl bg-gradient-to-l from-blue-600/10 to-purple-600/10"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative text-xl">{item.icon}</span>
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
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-1 h-4 rounded-full bg-blue-600"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
} 
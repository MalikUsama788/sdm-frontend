'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { HiMenu, HiX } from 'react-icons/hi';

export default function Header() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/trades', label: 'Trades' },
    { href: '/my-holdings', label: 'My Holdings' },
    { href: '/dividends', label: 'Dividends' },
    { href: '/investment-logs', label: 'Investment Logs' },
    { href: '/my-totals-with-index', label: 'My Totals' },
    { href: '/mutual-funds-totals', label: 'Mutual Funds' },
    { href: '/my-holdings-old', label: 'My Holdings Old' },
    { href: '/trade-summary', label: 'Trade Summary' },
  ];

  return (
    <header className="bg-gray-600 text-white p-4 flex items-center justify-between relative">
      <h1 className="text-xl font-bold">iStock Management</h1>

      {/* Desktop nav */}
      {session && (
        <nav className="hidden lg:flex gap-4 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-yellow-400 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut()}
            className="px-3 py-1 bg-red-400 rounded hover:bg-red-500 transition-colors"
          >
            Sign Out
          </button>
        </nav>
      )}

      {/* Mobile Hamburger */}
      {session && (
        <button
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <HiX size={28} /> : <HiMenu size={28} />}
        </button>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && session && (
        <div className="absolute top-16 left-0 w-full bg-gray-600 text-white flex flex-col p-4 lg:hidden z-50">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-2 px-2 hover:bg-gray-700 rounded"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut()}
            className="py-2 px-2 bg-red-400 rounded hover:bg-red-500 mt-2"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}

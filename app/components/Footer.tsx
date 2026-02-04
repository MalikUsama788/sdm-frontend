'use client';

export default function Footer() {
  return (
    <footer className="bg-gray-600 text-white p-4 text-center text-sm mt-auto">
      &copy; {new Date().getFullYear()} iStock Management. All rights reserved.
    </footer>
  );
}

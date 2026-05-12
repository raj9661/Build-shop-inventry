import { useRouter } from 'next/navigation';
import React from 'react';

function LogoutButton() {
  const router = useRouter();
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    router.push('/login');
  };
  return (
    <button onClick={handleLogout} className="w-full mt-4 py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition">
      Logout
    </button>
  );
}

export default function Sidebar(props: {}) {
  return (
    <div className="sidebar-container">
      <div className="flex-grow" />
      <LogoutButton />
    </div>
  );
} 
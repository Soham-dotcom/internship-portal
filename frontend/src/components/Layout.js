import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const SIDEBAR_WIDTH = 'w-60';

const navigation = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', href: '/' },
    ],
  },
  {
    group: 'Student Records',
    items: [
      { name: 'Internship Overview', href: '/internships' },
      { name: 'Student Record Edit', href: '/mentor-edit' },
      { name: 'Random Student Picker', href: '/picker' },
    ],
  },
  {
    group: 'Group Management',
    items: [
      { name: 'Group Generator', href: '/groups' },
      { name: 'All Groups', href: '/all-groups' },
    ],
  },
  {
    group: 'Mentors',
    items: [
      { name: 'Mentor Directory', href: '/all-mentors' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { name: 'Company-wise Analysis', href: '/analytics' },
    ],
  },
  {
    group: 'Data Import',
    items: [
      { name: 'Upload Excel Data', href: '/upload' },
    ],
  },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const isActive = (href) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-surface-page flex">
      {/* ---- Sidebar ---- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 ${SIDEBAR_WIDTH} bg-sidebar-bg flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <span className="text-base font-bold text-white tracking-wide">SPIT</span>
            <p className="text-xs text-slate-400 mt-0.5 leading-tight">
              Training &amp; Placement Office
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
            aria-label="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navigation.map((section) => (
            <div key={section.group}>
              <p className="px-3 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {section.group}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors
                          ${active
                            ? 'bg-accent-600 text-white'
                            : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                          }`}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500">Internship Analysis Portal</p>
          <p className="text-xs text-slate-600">Academic Year 2025–26</p>
        </div>
      </aside>

      {/* ---- Main area ---- */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${sidebarOpen ? 'lg:ml-60' : 'ml-0'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-800 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm text-gray-500 font-medium">
              Internship Analysis Portal &mdash; Administrative View
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;



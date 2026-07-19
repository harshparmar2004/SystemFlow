import React from 'react';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Users, Activity, BarChart2, Award, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { UserRole } from '../../types';

interface AdminSidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
}

export function AdminSidebar({ currentTab, setCurrentTab, userRole }: AdminSidebarProps) {
  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'registrations', name: 'Registrations', icon: Users, roles: ['admin'] },
    { id: 'checkins', name: 'Live Check-ins', icon: Activity, roles: ['admin', 'volunteer'] },
    { id: 'analytics', name: 'Analytics', icon: BarChart2, roles: ['admin'] },
    { id: 'certificates', name: 'Certificates', icon: Award, roles: ['admin'] },
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(userRole.role));

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <aside className="w-64 fixed inset-y-0 left-0 bg-sand-200 border-r border-border-muted flex flex-col p-6 hidden md:flex z-10">
      <div className="mb-10">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          Hackathon<span className="text-burnt-orange">Admin</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1 capitalize">{userRole.role} Portal</p>
      </div>

      <nav className="flex-1 space-y-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left",
                isActive ? "bg-white border border-border-muted text-burnt-orange font-medium" : 
                "text-gray-600 hover:bg-white/50 hover:text-gray-900"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center border",
                isActive ? "border-burnt-orange bg-orange-50 text-burnt-orange" :
                "border-transparent bg-transparent text-gray-400"
              )}>
                <Icon size={16} />
              </div>
              <span className="text-sm">{tab.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-border-muted">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-md flex items-center justify-center border border-transparent">
            <LogOut size={16} />
          </div>
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

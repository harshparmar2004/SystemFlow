import React from 'react';
import { cn } from '../lib/utils';
import { Calendar, Users, FileText, CheckCircle } from 'lucide-react';

interface SidebarProps {
  currentStep: number;
}

export function Sidebar({ currentStep }: SidebarProps) {
  const steps = [
    { id: 1, name: 'Team Info', icon: Calendar },
    { id: 2, name: 'Members', icon: Users },
    { id: 3, name: 'Review', icon: FileText },
    { id: 4, name: 'Submit', icon: CheckCircle },
  ];

  return (
    <aside className="w-64 fixed inset-y-0 left-0 bg-sand-200 border-r border-border-muted flex flex-col p-6 hidden md:flex">
      <div className="mb-10">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          Hackathon<span className="text-burnt-orange">Reg</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">College Hackathon System</p>
      </div>

      <nav className="flex-1 space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isPast = currentStep > step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                isActive ? "bg-white border border-border-muted text-burnt-orange font-medium" : 
                isPast ? "text-gray-900 font-medium" : "text-gray-500"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center border",
                isActive ? "border-burnt-orange bg-orange-50 text-burnt-orange" :
                isPast ? "border-border-muted bg-white text-gray-900" :
                "border-transparent bg-transparent text-gray-400"
              )}>
                <Icon size={16} />
              </div>
              <span className="text-sm">{step.name}</span>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-border-muted">
        <p className="text-xs text-gray-500">&copy; 2026 Hackathon System</p>
      </div>
    </aside>
  );
}

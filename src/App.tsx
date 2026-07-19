/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HackathonForm } from './components/HackathonForm';
import { Scanner } from './components/Scanner';
import { AdminDashboard } from './components/Admin/AdminDashboard';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [route, setRoute] = useState('home');

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/scanner' || window.location.search.includes('scanner=true')) {
      setRoute('scanner');
    } else if (path === '/admin' || window.location.search.includes('admin=true')) {
      setRoute('admin');
    }
  }, []);

  if (route === 'scanner') {
    return <Scanner />;
  }

  if (route === 'admin') {
    return <AdminDashboard />;
  }

  return (
    <div className="min-h-screen bg-sand-100 flex">
      <Sidebar currentStep={currentStep} />
      
      <main className="flex-1 md:ml-64 relative min-h-screen">
        {/* Mobile Header */}
        <div className="md:hidden bg-sand-200 border-b border-border-muted p-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">
            Hackathon<span className="text-burnt-orange">Reg</span>
          </h1>
          <div className="text-xs font-medium text-gray-500">
            Step {currentStep} of 4
          </div>
        </div>

        <HackathonForm currentStep={currentStep} setCurrentStep={setCurrentStep} />
      </main>
    </div>
  );
}

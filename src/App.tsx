/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { HackathonForm } from './components/HackathonForm';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);

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

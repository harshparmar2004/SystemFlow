import React from 'react';
import { Award } from 'lucide-react';

export function Certificates() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-burnt-orange/10 text-burnt-orange rounded-2xl flex items-center justify-center mb-6">
        <Award size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Certificate Generation</h2>
      <p className="text-gray-500 max-w-md">
        This feature will allow you to bulk generate and email PDF certificates of participation to all checked-in teams after the event concludes.
      </p>
      <button 
        disabled
        className="mt-8 px-6 py-2 bg-sand-200 text-gray-500 rounded-md font-medium cursor-not-allowed"
      >
        Coming Soon
      </button>
    </div>
  );
}

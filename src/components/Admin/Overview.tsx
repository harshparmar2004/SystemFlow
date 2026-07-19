import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Team } from '../../types';
import { Users, CheckCircle, ShieldCheck } from 'lucide-react';

export function Overview() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'teams'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ teamId: doc.id, ...doc.data() } as Team));
      setTeams(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading overview...</div>;
  }

  // Calculate stats
  const totalRegistered = teams.length;
  const totalVerified = teams.filter(t => t.status === 'verified' || t.status === 'checked_in').length;
  const totalCheckedIn = teams.filter(t => t.status === 'checked_in').length;

  // Group by event
  const events = Array.from(new Set(teams.map(t => t.eventId)));

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-border-muted rounded-lg p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Registered</p>
            <p className="text-3xl font-bold text-gray-900">{totalRegistered}</p>
          </div>
        </div>

        <div className="bg-white border border-border-muted rounded-lg p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Verified Teams</p>
            <p className="text-3xl font-bold text-gray-900">{totalVerified}</p>
          </div>
        </div>

        <div className="bg-white border border-border-muted rounded-lg p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-burnt-orange/10 text-burnt-orange rounded-lg flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Checked In</p>
            <p className="text-3xl font-bold text-gray-900">{totalCheckedIn}</p>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-4">By Event</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map(eventId => {
          const eventTeams = teams.filter(t => t.eventId === eventId);
          return (
            <div key={eventId} className="bg-white border border-border-muted rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">{eventId}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Registered</span>
                  <span className="font-medium">{eventTeams.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Verified</span>
                  <span className="font-medium">{eventTeams.filter(t => t.status === 'verified' || t.status === 'checked_in').length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Checked In</span>
                  <span className="font-medium">{eventTeams.filter(t => t.status === 'checked_in').length}</span>
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="col-span-full p-6 text-center text-gray-500 bg-white border border-border-muted rounded-lg">
            No registrations found.
          </div>
        )}
      </div>
    </div>
  );
}

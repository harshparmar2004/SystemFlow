import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Team } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList
} from 'recharts';
import { format, parseISO } from 'date-fns';

export function Analytics() {
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

  const funnelData = useMemo(() => {
    const total = teams.length;
    const otpSent = teams.filter(t => t.status === 'otp_sent' || t.status === 'verified' || t.status === 'checked_in').length;
    const verified = teams.filter(t => t.status === 'verified' || t.status === 'checked_in').length;
    const checkedIn = teams.filter(t => t.status === 'checked_in').length;

    return [
      { name: 'Started (Pending)', value: total, fill: '#D4C3B3' },
      { name: 'Submitted (OTP)', value: otpSent, fill: '#E8DECF' },
      { name: 'Verified', value: verified, fill: '#D97B3F' },
      { name: 'Checked In', value: checkedIn, fill: '#C26B33' },
    ];
  }, [teams]);

  const timelineData = useMemo(() => {
    const countsByDate: Record<string, number> = {};
    
    teams.forEach(t => {
      if (t.createdAt) {
        // Group by day
        const date = format(t.createdAt.toMillis(), 'MMM dd');
        countsByDate[date] = (countsByDate[date] || 0) + 1;
      }
    });

    return Object.keys(countsByDate).sort((a, b) => {
      // Sort string dates (MMM dd) roughly by putting them in current year context
      return new Date(`${a} 2026`).getTime() - new Date(`${b} 2026`).getTime();
    }).map(date => ({
      date,
      registrations: countsByDate[date]
    }));
  }, [teams]);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading analytics...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-500 mt-1">Registration conversion and timeline trends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Funnel Chart */}
        <div className="bg-white border border-border-muted rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Conversion Funnel</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <RechartsTooltip />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#4B5563" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-gray-500 mt-4">Drop-off rates across the registration lifecycle.</p>
        </div>

        {/* Bar Chart */}
        <div className="bg-white border border-border-muted rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Registrations Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: '#F5EFE6'}}
                  contentStyle={{borderRadius: '8px', border: '1px solid #D4C3B3', boxShadow: 'none'}}
                />
                <Bar dataKey="registrations" fill="#D97B3F" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

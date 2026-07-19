import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Team, UserRole } from '../../types';
import { CheckCircle2, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LiveCheckinsProps {
  userRole: UserRole;
}

export function LiveCheckins({ userRole }: LiveCheckinsProps) {
  const [recentCheckins, setRecentCheckins] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Basic query for recent check-ins
    let q = query(
      collection(db, 'teams'), 
      where('status', '==', 'checked_in'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    // If volunteer, only show their assigned event (if any)
    if (userRole.role === 'volunteer' && userRole.assignedEventId) {
       q = query(
        collection(db, 'teams'), 
        where('status', '==', 'checked_in'),
        where('eventId', '==', userRole.assignedEventId),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ teamId: doc.id, ...doc.data() } as Team));
      setRecentCheckins(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [userRole]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Check-ins</h2>
          <p className="text-gray-500 mt-1">
            {userRole.role === 'volunteer' 
              ? `Monitoring for ${userRole.assignedEventId || 'all events'} - Gate: ${userRole.assignedGateId || 'Any'}` 
              : 'Real-time feed of all event check-ins'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live
        </div>
      </div>

      <div className="bg-white border border-border-muted rounded-lg p-1">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Connecting to live feed...</div>
        ) : recentCheckins.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No check-ins yet.</p>
            <p className="text-sm text-gray-400 mt-1">Waiting for the first scan...</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-muted">
            {recentCheckins.map((team) => (
              <li key={team.teamId} className="p-4 hover:bg-sand-50/50 transition-colors flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">{team.teamName}</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <MapPin size={14} /> 
                      {team.eventId}
                    </p>
                    <div className="text-xs text-gray-400 mt-1">
                      {team.members.length} members • Lead: {team.members.find(m => m.role === 'lead')?.name}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-2">
                    Checked In
                  </span>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {team.updatedAt ? formatDistanceToNow(team.updatedAt.toMillis(), { addSuffix: true }) : 'Just now'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

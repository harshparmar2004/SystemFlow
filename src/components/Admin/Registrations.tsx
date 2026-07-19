import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Team } from '../../types';
import { Search, Download, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Registrations() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ teamId: doc.id, ...doc.data() } as Team));
      setTeams(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.teamName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportCSV = () => {
    if (filteredTeams.length === 0) return;

    const headers = [
      'Team ID', 'Team Name', 'Event ID', 'Status', 
      'Created At', 'Member 1 Name', 'Member 1 Email', 'Member 1 Phone', 'Member 1 College ID', 'Member 1 Role',
      'Member 2 Name', 'Member 2 Email', 'Member 2 Phone', 'Member 2 College ID', 'Member 2 Role',
      'Member 3 Name', 'Member 3 Email', 'Member 3 Phone', 'Member 3 College ID', 'Member 3 Role',
      'Member 4 Name', 'Member 4 Email', 'Member 4 Phone', 'Member 4 College ID', 'Member 4 Role',
    ];

    const rows = filteredTeams.map(t => {
      const date = t.createdAt ? new Date(t.createdAt.toMillis()).toLocaleString() : '';
      const baseInfo = [t.teamId, t.teamName, t.eventId, t.status, date];
      
      const memberInfo = [];
      for (let i = 0; i < 4; i++) {
        if (t.members[i]) {
          const m = t.members[i];
          memberInfo.push(m.name, m.email, m.phone, m.collegeId, m.role);
        } else {
          memberInfo.push('', '', '', '', '');
        }
      }
      return [...baseInfo, ...memberInfo].map(v => `"${v}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `registrations_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      otp_sent: "bg-blue-100 text-blue-800",
      verified: "bg-green-100 text-green-800",
      checked_in: "bg-burnt-orange/20 text-burnt-orange-dark",
    };
    return (
      <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider", styles[status] || "bg-gray-100 text-gray-800")}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Registrations</h2>
        
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border-muted text-gray-700 rounded-md text-sm font-medium hover:bg-sand-50 transition-colors"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="bg-white border border-border-muted rounded-lg flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-border-muted flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors text-sm"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 pl-3 pr-8 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors text-sm appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="otp_sent">OTP Sent</option>
              <option value="verified">Verified</option>
              <option value="checked_in">Checked In</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-sand-50 border-b border-border-muted sticky top-0">
              <tr>
                <th className="px-6 py-3 font-medium">Team Name</th>
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">Members</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading registrations...</td>
                </tr>
              ) : filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No teams found matching criteria.</td>
                </tr>
              ) : (
                filteredTeams.map((team) => (
                  <tr key={team.teamId} className="border-b border-border-muted last:border-0 hover:bg-sand-50/50">
                    <td className="px-6 py-4 font-medium text-gray-900">{team.teamName}</td>
                    <td className="px-6 py-4">{team.eventId}</td>
                    <td className="px-6 py-4">
                      {team.members.length} members
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">
                        {team.members.map(m => m.name).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(team.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {team.createdAt ? new Date(team.createdAt.toMillis()).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

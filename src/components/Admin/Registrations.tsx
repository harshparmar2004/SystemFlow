import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFunctions as getFirebaseFunctions, httpsCallable as firebaseHttpsCallable } from 'firebase/functions';
import { app, db } from '../../lib/firebase';
import { Team } from '../../types';
import { Search, Download, Filter, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Registrations() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

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
    let matchesDelivery = true;
    if (deliveryFilter === 'failed') matchesDelivery = t.deliveryStatus === 'failed';
    else if (deliveryFilter === 'pending') matchesDelivery = t.deliveryStatus === 'pending';
    else if (deliveryFilter === 'delivered') matchesDelivery = t.deliveryStatus === 'delivered';
    
    return matchesSearch && matchesStatus && matchesDelivery;
  });

  const exportCSV = () => {
    if (filteredTeams.length === 0) return;

    const headers = [
      'Team ID', 'Team Name', 'Team Code', 'Event ID', 'Status', 'Delivery Status',
      'Created At', 'Member 1 Name', 'Member 1 Email', 'Member 1 Phone', 'Member 1 College ID', 'Member 1 Role',
      'Member 2 Name', 'Member 2 Email', 'Member 2 Phone', 'Member 2 College ID', 'Member 2 Role',
      'Member 3 Name', 'Member 3 Email', 'Member 3 Phone', 'Member 3 College ID', 'Member 3 Role',
      'Member 4 Name', 'Member 4 Email', 'Member 4 Phone', 'Member 4 College ID', 'Member 4 Role',
    ];

    const rows = filteredTeams.map(t => {
      const date = t.createdAt ? new Date(t.createdAt.toMillis()).toLocaleString() : '';
      const baseInfo = [t.teamId, t.teamName, t.teamCode || '', t.eventId, t.status, t.deliveryStatus || '', date];
      
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

  const handleResend = async (teamId: string, channel: 'email' | 'whatsapp' = 'email') => {
    try {
      setResendingId(teamId);
      const functions = getFirebaseFunctions(app);
      const resendQr = firebaseHttpsCallable(functions, 'resendQr');
      await resendQr({ teamId, channel });
    } catch (err) {
      console.error("Failed to resend QR:", err);
      alert("Failed to queue resend request.");
    } finally {
      setResendingId(null);
    }
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

  const getDeliveryStatus = (team: Team) => {
    if (!team.deliveryStatus && team.status !== 'verified' && team.status !== 'checked_in') {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    if (team.deliveryStatus === 'failed') {
      return (
        <div className="flex items-center gap-1.5 text-red-600">
          <AlertCircle size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">Failed</span>
        </div>
      );
    }
    if (team.deliveryStatus === 'pending') {
      return (
        <div className="flex items-center gap-1.5 text-yellow-600">
          <Clock size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
        </div>
      );
    }
    if (team.deliveryStatus === 'delivered') {
      return (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">
            Sent ({team.deliveredVia || 'email'})
          </span>
        </div>
      );
    }
    return <span className="text-gray-400 text-xs">Unknown</span>;
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
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-40 pl-3 pr-8 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors text-sm appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="otp_sent">OTP Sent</option>
                <option value="verified">Verified</option>
                <option value="checked_in">Checked In</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
            <div className="relative">
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="w-full sm:w-48 pl-3 pr-8 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors text-sm appearance-none"
              >
                <option value="all">All Deliveries</option>
                <option value="failed">Failed Deliveries</option>
                <option value="pending">Pending Deliveries</option>
                <option value="delivered">Delivered Successfully</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-sand-50 border-b border-border-muted sticky top-0">
              <tr>
                <th className="px-6 py-3 font-medium">Team Info</th>
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Delivery Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
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
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{team.teamName}</div>
                      {team.teamCode && (
                        <div className="text-xs font-mono text-gray-500 mt-0.5">{team.teamCode}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">
                        {team.members.map(m => m.name).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">{team.eventId}</td>
                    <td className="px-6 py-4">{getStatusBadge(team.status)}</td>
                    <td className="px-6 py-4">
                      {getDeliveryStatus(team)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(team.status === 'verified' || team.status === 'checked_in') && (
                        <button
                          onClick={() => handleResend(team.teamId!)}
                          disabled={resendingId === team.teamId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <RefreshCw size={12} className={cn(resendingId === team.teamId && "animate-spin")} />
                          {resendingId === team.teamId ? 'Queuing...' : 'Resend QR'}
                        </button>
                      )}
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

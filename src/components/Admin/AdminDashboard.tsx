import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '../../types';
import { AdminSidebar } from './AdminSidebar';
import { Overview } from './Overview';
import { Registrations } from './Registrations';
import { LiveCheckins } from './LiveCheckins';
import { Analytics } from './Analytics';
import { Certificates } from './Certificates';
import { Loader2 } from 'lucide-react';

export function AdminDashboard() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('overview');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const roleData = userDoc.data() as UserRole;
            setUserRole(roleData);
            if (roleData.role === 'volunteer') {
              setCurrentTab('checkins');
            }
          } else {
            const isHarshAdmin = currentUser.email === 'harshparmar686630@gmail.com' || currentUser.email === 'harshparmar686630@gmaiil.com';
            setUserRole({ uid: currentUser.uid, email: currentUser.email || '', role: isHarshAdmin ? 'admin' : 'student' });
          }
        } catch (err) {
          console.error("Error fetching user role", err);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-100">
        <Loader2 className="animate-spin text-burnt-orange" size={32} />
      </div>
    );
  }

  if (!userRole) {
    return null; // Should be handled by App.tsx
  }

  const isAllowed = (tab: string) => {
    if (userRole.role === 'admin') return true;
    if (userRole.role === 'volunteer' && tab === 'checkins') return true;
    return false;
  };

  const renderTab = () => {
    if (!isAllowed(currentTab)) {
      return <div className="p-8 text-red-500">Access Denied</div>;
    }

    switch (currentTab) {
      case 'overview':
        return <Overview />;
      case 'registrations':
        return <Registrations />;
      case 'checkins':
        return <LiveCheckins userRole={userRole} />;
      case 'analytics':
        return <Analytics />;
      case 'certificates':
        return <Certificates />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="min-h-screen bg-sand-100 flex">
      <AdminSidebar currentTab={currentTab} setCurrentTab={setCurrentTab} userRole={userRole} />
      
      <main className="flex-1 md:ml-64 relative min-h-screen">
        <div className="md:hidden bg-sand-200 border-b border-border-muted p-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-lg font-bold text-gray-900">
            Hackathon<span className="text-burnt-orange">Admin</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-xs font-medium text-gray-500 capitalize">
              {userRole.role}
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="text-xs text-gray-600 hover:text-red-600 underline"
            >
              Sign Out
            </button>
          </div>
        </div>
        {renderTab()}
      </main>
    </div>
  );
}

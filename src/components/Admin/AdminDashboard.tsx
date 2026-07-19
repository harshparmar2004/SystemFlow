import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '../../types';
import { AdminSidebar } from './AdminSidebar';
import { Overview } from './Overview';
import { Registrations } from './Registrations';
import { LiveCheckins } from './LiveCheckins';
import { Analytics } from './Analytics';
import { Certificates } from './Certificates';
import { Loader2, AlertCircle } from 'lucide-react';

export function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('overview');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch role
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const roleData = userDoc.data() as UserRole;
            setUserRole(roleData);
            if (roleData.role === 'volunteer') {
              setCurrentTab('checkins'); // Volunteers default to check-ins
            }
          } else {
            // Default to admin for demo purposes if no doc found (or you can deny access)
            const defaultAdmin: UserRole = { uid: currentUser.uid, email: currentUser.email || '', role: 'admin' };
            setUserRole(defaultAdmin);
          }
        } catch (err) {
          console.error("Error fetching user role", err);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setLoginError(err.message || 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-100">
        <Loader2 className="animate-spin text-burnt-orange" size={32} />
      </div>
    );
  }

  if (!user || !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-100 p-4">
        <div className="bg-white border border-border-muted rounded-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Hackathon<span className="text-burnt-orange">Admin</span>
            </h1>
            <p className="text-gray-500 text-sm mt-2">Sign in to access the portal</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-sand-50 border border-border-muted rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange"
              />
            </div>
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2 bg-burnt-orange text-white rounded-md font-medium hover:bg-burnt-orange-dark transition-colors flex justify-center items-center gap-2"
            >
              {isLoggingIn ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-border-muted text-xs text-center text-gray-400">
            Demo credentials for testing if accounts are not set up: 
            <br/> admin@example.com / password123
          </div>
        </div>
      </div>
    );
  }

  // Ensure current tab is allowed for role
  const isAllowed = (tab: string) => {
    if (userRole.role === 'admin') return true;
    if (userRole.role === 'volunteer' && tab === 'checkins') return true;
    return false;
  };

  // Render the appropriate tab content
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
        {/* Mobile Header */}
        <div className="md:hidden bg-sand-200 border-b border-border-muted p-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-lg font-bold text-gray-900">
            Hackathon<span className="text-burnt-orange">Admin</span>
          </h1>
          <div className="text-xs font-medium text-gray-500 capitalize">
            {userRole.role}
          </div>
        </div>

        {renderTab()}
      </main>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HackathonForm } from './components/HackathonForm';
import { Scanner } from './components/Scanner';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [route, setRoute] = useState('home');
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data() as UserRole);
          } else {
            // Default role logic
            const isHarshAdmin = currentUser.email === 'harshparmar686630@gmail.com' || currentUser.email === 'harshparmar686630@gmaiil.com';
            setUserRole({ 
              uid: currentUser.uid, 
              email: currentUser.email || '', 
              role: isHarshAdmin ? 'admin' : 'student' 
            });
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

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/scanner' || window.location.search.includes('scanner=true')) {
      setRoute('scanner');
    } else if (path === '/admin' || window.location.search.includes('admin=true')) {
      setRoute('admin');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-100">
        <Loader2 className="animate-spin text-burnt-orange" size={32} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  useEffect(() => {
    if (userRole) {
      if (route === 'admin' && userRole.role !== 'admin' && userRole.role !== 'volunteer') {
        setRoute('home');
      } else if (route === 'home' && userRole.role === 'admin') {
        setRoute('admin');
      }
    }
  }, [userRole, route]);

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
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-gray-500">
              Step {currentStep} of 4
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="text-xs text-gray-600 hover:text-red-600 underline"
            >
              Sign Out
            </button>
          </div>
        </div>

        <HackathonForm currentStep={currentStep} setCurrentStep={setCurrentStep} />
      </main>
    </div>
  );
}

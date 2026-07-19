import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';

export function AuthScreen({ onSignIn }: { onSignIn?: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Define role
        const role = email === 'harshparmar686630@gmail.com' ? 'admin' : 'student';
        
        // Create user document
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          role: role
        });
      }
      if (onSignIn) {
        onSignIn();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-100 p-4">
      <div className="bg-white border border-border-muted rounded-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Hackathon<span className="text-burnt-orange">Portal</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={isLoading}
            className="w-full py-2 bg-burnt-orange text-white rounded-md font-medium hover:bg-burnt-orange-dark transition-colors flex justify-center items-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-border-muted text-sm text-center text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-burnt-orange font-medium hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

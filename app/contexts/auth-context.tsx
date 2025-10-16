"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { backendApiService } from '@/lib/services/backend-api';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      setIsLoading(false);
    };
    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await backendApiService.logout();
      setIsAuthenticated(false);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if backend call fails
      setIsAuthenticated(false);
      router.push('/login');
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

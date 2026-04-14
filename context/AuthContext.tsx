"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface AppUser {
  enrollment_no: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  mobile: string;
  gender: string;
  domain: string;
  course: string;
  specialization: string;
  team_id: string | null;
  role: string;
  isPasswordSet: boolean;
  isInvited: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
}

interface AuthContextType {
  appUser: AppUser | null;
  user: AppUser | null;
  loading: boolean;
  login: (enrollmentNo: string) => Promise<AppUser | null>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (enrollmentNo: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', enrollmentNo));
      if (userDoc.exists()) {
        const data = userDoc.data() as AppUser;
        setAppUser(data);
        return data;
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
    return null;
  };

  const refreshUser = async () => {
    const enrollmentNo = localStorage.getItem('hackathon_session_user');
    if (enrollmentNo) {
      await fetchUserData(enrollmentNo);
    }
  };

  useEffect(() => {
    const enrollmentNo = localStorage.getItem('hackathon_session_user');
    if (enrollmentNo) {
      fetchUserData(enrollmentNo).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (enrollmentNo: string) => {
    localStorage.setItem('hackathon_session_user', enrollmentNo);
    return await fetchUserData(enrollmentNo);
  };

  const logout = () => {
    localStorage.removeItem('hackathon_session_user');
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      appUser, 
      user: appUser, 
      loading, 
      login, 
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

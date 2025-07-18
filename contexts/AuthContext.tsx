'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  lastLogin?: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (requiredRole: string) => boolean;
  canAccessResource: (resource: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const roleHierarchy = {
    'SUPER_ADMIN': 4,
    'ADMIN': 3,
    'MANAGER': 2,
    'VIEWER': 1,
  };

  const permissions = {
    'SUPER_ADMIN': ['*'], // All permissions
    'ADMIN': [
      'dashboard',
      'customers',
      'vendors',
      'orders',
      'riders',
      'deliveries',
      'food',
      'grocery',
      'medicine',
      'appointments',
      'emirates',
    ],
    'MANAGER': [
      'dashboard',
      'customers',
      'orders',
      'deliveries',
      'food',
      'grocery',
      'medicine',
      'appointments',
    ],
    'VIEWER': [
      'dashboard',
      'customers',
      'orders',
      'deliveries',
    ],
  };

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const hasPermission = (requiredRole: string): boolean => {
    if (!user) return false;
    
    const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  };

  const canAccessResource = (resource: string): boolean => {
    if (!user) return false;

    const userPermissions = permissions[user.role as keyof typeof permissions] || [];
    
    // Super admin has access to everything
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check if user has specific permission
    return userPermissions.includes(resource);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    hasPermission,
    canAccessResource,
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

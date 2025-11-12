'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const login = async (email: string, password: string) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid email or password');
        return { success: false, error: result.error };
      }

      if (result?.ok) {
        toast.success('Successfully logged in!');
        router.push('/trips');
        router.refresh();
        return { success: true };
      }

      return { success: false, error: 'Unknown error occurred' };
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
      return { success: false, error: 'An error occurred' };
    }
  };

  const logout = async () => {
    try {
      await signOut({ redirect: false });
      toast.success('Successfully logged out');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('An error occurred during logout');
    }
  };

  const register = async (data: {
    email: string;
    username: string;
    password: string;
    fullName?: string;
  }) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Registration failed');
        return { success: false, error: result.error };
      }

      toast.success('Account created successfully!');

      // Auto-login after registration
      const loginResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        router.push('/trips');
        router.refresh();
        return { success: true };
      }

      // Registration succeeded but login failed, redirect to login
      router.push('/auth/login');
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('An error occurred during registration');
      return { success: false, error: 'An error occurred' };
    }
  };

  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
    login,
    logout,
    register,
    session,
  };
}

// Helper functions for checking auth state
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (!isLoading && !isAuthenticated) {
    router.push('/auth/login');
  }

  return { isAuthenticated, isLoading };
}

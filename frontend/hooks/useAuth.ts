'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from './useToast';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'owner' | 'manager' | 'staff';
  restaurantId?: string;
}
export interface IOpeningHour {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface ISocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export interface IOrderSettings {
  qrOrderingEnabled: boolean;
  whatsappOrderingEnabled: boolean;
}

export interface IWhatsappSettings {
  whatsappNumber?: string;
  businessName?: string;
  orderPrefix?: string;
  notificationsEnabled?: boolean;
  autoSend?: boolean;
  timezone?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  cuisine?: string[];
  gstNumber?: string;
  socialLinks?: ISocialLinks;
  openingHours?: IOpeningHour[];
  isAvailable: boolean;
  isSuspended?: boolean;
  orderSettings?: IOrderSettings;
  whatsappSettings?: IWhatsappSettings;
}
export interface AuthState {
  user: User | null;
  restaurant: Restaurant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  // Query to fetch current authenticated user profile
  const {
    data: authData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data && res.data.success) {
          // Sync localStorage
          localStorage.setItem('dishiq_user', JSON.stringify(res.data.user));
          return {
            user: res.data.user as User,
            restaurant: res.data.restaurant as Restaurant | null
          };
        }
        return null;
      } catch (error) {
        // Clear local storage if token expired or invalid
        localStorage.removeItem('dishiq_token');
        localStorage.removeItem('dishiq_user');
        return null;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000 // 10 minutes cache
  });

  // Mutation: Register
  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; restaurantName: string }) => {
      const res = await api.post('/auth/register', data);
      return res.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('dishiq_token', data.token);
      localStorage.setItem('dishiq_user', JSON.stringify(data.user));
      queryClient.setQueryData(['auth-user'], {
        user: data.user,
        restaurant: data.restaurant
      });
      toast.success('Registration successful!', `Welcome to Dishiq, ${data.restaurant.name}.`);
      router.push('/dashboard');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Registration failed. Please try again.';
      toast.error('Registration failed', msg);
    }
  });

  // Mutation: Login
  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post('/auth/login', data);
      return res.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('dishiq_token', data.token);
      localStorage.setItem('dishiq_user', JSON.stringify(data.user));
      queryClient.setQueryData(['auth-user'], {
        user: data.user,
        restaurant: data.restaurant
      });
      toast.success('Login successful!', 'Welcome back.');
      if (data.user?.role === 'superadmin') {
        router.push('/superadmin');
      } else {
        router.push('/dashboard');
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Invalid credentials. Please try again.';
      toast.error('Login failed', msg);
    }
  });

  // Mutation: Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      localStorage.removeItem('dishiq_token');
      localStorage.removeItem('dishiq_user');
      queryClient.setQueryData(['auth-user'], null);
      queryClient.clear(); // Clear all cache on logout
      toast.success('Logged out', 'You have been successfully logged out.');
      router.push('/login');
    },
    onError: () => {
      // Fallback logout even if API fails
      localStorage.removeItem('dishiq_token');
      localStorage.removeItem('dishiq_user');
      queryClient.setQueryData(['auth-user'], null);
      toast.success('Logged out', 'Session cleared.');
      router.push('/login');
    }
  });

  return {
    user: authData?.user || null,
    restaurant: authData?.restaurant || null,
    isAuthenticated: !!authData?.user,
    isLoading,
    isError,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetchAuth: refetch
  };
}

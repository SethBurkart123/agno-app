import { useState, useEffect } from 'react';
import { backendApiService, UserProfile } from '@/lib/services/backend-api';
import { supabase } from '@/lib/supabase';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure there is a session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }
      
      const userProfile = await backendApiService.getUserProfile();
      setProfile(userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Failed to load user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; avatar_url?: string }) => {
    try {
      setError(null);
      const updatedProfile = await backendApiService.updateUserProfile(updates);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      console.error('Failed to update user profile:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile: loadProfile,
  };
}

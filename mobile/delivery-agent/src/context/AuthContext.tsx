import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  requestDeliveryAgentOTP,
  verifyDeliveryAgentOTP,
  refreshAccessToken,
  onSessionExpired,
  type RequestOTPResponse,
  type VerifyOTPResponse,
  ApiError,
} from '../services/api';
import { tokenStorage, type StoredUserData } from '../services/storage';

interface AuthContextValue {
  user: StoredUserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requestOTP: (identifier: string) => Promise<RequestOTPResponse>;
  verifyOTP: (challengeId: string, otp: string) => Promise<VerifyOTPResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await tokenStorage.clearAll();
    } finally {
      setUser(null);
    }
  }, []);

  // Hook into centralized API session expiration
  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
    });
    return () => onSessionExpired(null);
  }, []);

  // Session restoration on startup
  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      try {
        const storedUser = await tokenStorage.getUserData();
        const refreshToken = await tokenStorage.getRefreshToken();

        if (storedUser && refreshToken) {
          // Immediately hydrate user state so the UI renders the authenticated session without flashing login
          if (!isCancelled) {
            setUser(storedUser);
            setIsLoading(false);
          }

          // Validate and rotate token with backend in background
          try {
            const refreshRes = await refreshAccessToken(refreshToken);
            await tokenStorage.updateAccessToken(refreshRes.access);
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              // Deactivated agent or expired/revoked refresh token
              await tokenStorage.clearAll();
              if (!isCancelled) setUser(null);
            }
          }
          return;
        } else if (storedUser || refreshToken) {
          await tokenStorage.clearAll();
          if (!isCancelled) setUser(null);
        } else {
          if (!isCancelled) setUser(null);
        }
      } catch {
        if (!isCancelled) setUser(null);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleRequestOTP = useCallback(async (identifier: string): Promise<RequestOTPResponse> => {
    return await requestDeliveryAgentOTP(identifier);
  }, []);

  const handleVerifyOTP = useCallback(
    async (challengeId: string, otp: string): Promise<VerifyOTPResponse> => {
      const response = await verifyDeliveryAgentOTP(challengeId, otp);
      await tokenStorage.saveTokens(response.access, response.refresh);
      await tokenStorage.saveUserData(response.user);
      setUser(response.user);
      return response;
    },
    []
  );

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    requestOTP: handleRequestOTP,
    verifyOTP: handleVerifyOTP,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


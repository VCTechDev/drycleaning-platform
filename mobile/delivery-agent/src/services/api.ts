import { Platform } from 'react-native';
import { tokenStorage, type StoredUserData } from './storage';

function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // Android emulator routes host localhost via 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://localhost:8000/api';
}

export const API_BASE_URL = getDefaultApiBaseUrl();

export interface RequestOTPResponse {
  message: string;
  challenge_id: string;
  resend_cooldown_seconds: number;
  expires_in_seconds: number;
}

export interface RequestEmailVerificationResponse {
  message: string;
  resend_cooldown_seconds: number;
  expires_in_seconds: number;
}

export interface ConfirmEmailVerificationResponse {
  message: string;
}

export interface VerifyOTPResponse {
  refresh: string;
  access: string;
  user: StoredUserData;
  role: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export interface ApiErrorPayload {
  detail?: string;
  message?: string;
  code?: string;
  resend_cooldown_seconds?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  resendCooldownSeconds?: number;
  data?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    resendCooldownSeconds?: number,
    data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.resendCooldownSeconds = resendCooldownSeconds;
    this.data = data;
  }
}

/**
 * Extracts a human-friendly error message from backend responses.
 * Handles `detail`, `message`, and field validation error dictionaries.
 */
export function extractErrorMessage(data: unknown, status: number): string {
  if (!data || typeof data !== 'object') {
    if (status === 429) return 'Too many attempts. Please try again later.';
    if (status === 503) return 'Service temporarily unavailable. Please try again shortly.';
    if (status >= 500) return 'Server error. Please try again later.';
    return 'An unexpected error occurred. Please try again.';
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  // Handle dictionary of field validation errors (e.g. { identifier: ["..."], otp: ["..."] })
  const fieldErrors: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'code' || key === 'resend_cooldown_seconds') continue;
    if (Array.isArray(value)) {
      fieldErrors.push(`${value.join(' ')}`);
    } else if (typeof value === 'string' && value.trim()) {
      fieldErrors.push(`${value.trim()}`);
    }
  }

  if (fieldErrors.length > 0) {
    return fieldErrors.join(' ');
  }

  if (status === 401) return 'Authentication failed. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 429) return 'Too many attempts. Please try again later.';
  if (status >= 500) return 'Unable to process request right now. Please try again later.';

  return 'An error occurred. Please check your input and try again.';
}

/**
 * Request delivery agent login OTP
 */
export async function requestDeliveryAgentOTP(identifier: string): Promise<RequestOTPResponse> {
  const url = `${API_BASE_URL}/auth/delivery-agent/request-otp/`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
  } catch {
    throw new ApiError(
      'Network connection error. Please check your internet connection.',
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.status);
    const cooldown = typeof data?.resend_cooldown_seconds === 'number'
      ? data.resend_cooldown_seconds
      : undefined;
    throw new ApiError(message, response.status, data?.code, cooldown, data);
  }

  return data as RequestOTPResponse;
}

/**
 * Verify delivery agent login OTP
 */
export async function verifyDeliveryAgentOTP(
  challengeId: string,
  otp: string
): Promise<VerifyOTPResponse> {
  const url = `${API_BASE_URL}/auth/delivery-agent/verify-otp/`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        challenge_id: challengeId.trim(),
        otp: otp.trim(),
      }),
    });
  } catch {
    throw new ApiError(
      'Network connection error. Please check your internet connection.',
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.status);
    throw new ApiError(message, response.status, data?.code, undefined, data);
  }

  return data as VerifyOTPResponse;
}

/**
 * Request onboarding email verification code for delivery agent
 */
export async function requestDeliveryAgentEmailVerification(
  identifier: string
): Promise<RequestEmailVerificationResponse> {
  const url = `${API_BASE_URL}/auth/delivery-agent/verify-email/request/`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
  } catch {
    throw new ApiError(
      'Network connection error. Please check your internet connection.',
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.status);
    const cooldown = typeof data?.resend_cooldown_seconds === 'number'
      ? data.resend_cooldown_seconds
      : undefined;
    throw new ApiError(message, response.status, data?.code, cooldown, data);
  }

  return data as RequestEmailVerificationResponse;
}

/**
 * Confirm onboarding email verification code for delivery agent
 */
export async function confirmDeliveryAgentEmailVerification(
  identifier: string,
  otp: string
): Promise<ConfirmEmailVerificationResponse> {
  const url = `${API_BASE_URL}/auth/delivery-agent/verify-email/confirm/`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        otp: otp.trim(),
      }),
    });
  } catch {
    throw new ApiError(
      'Network connection error. Please check your internet connection.',
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.status);
    throw new ApiError(message, response.status, data?.code, undefined, data);
  }

  return data as ConfirmEmailVerificationResponse;
}

/**
 * Refresh access token using stored refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const url = `${API_BASE_URL}/token/refresh/`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });
  } catch {
    throw new ApiError(
      'Network connection error during token refresh.',
      0
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.status);
    throw new ApiError(message, response.status, data?.code, undefined, data);
  }

  return data as RefreshTokenResponse;
}

// Session expired listener registry
let sessionExpiredHandler: (() => void) | null = null;

export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

// Centralized deduplication promise for in-flight refresh calls
let activeRefreshPromise: Promise<string> | null = null;

/**
 * Centralized token refresh function with duplicate call collapsing.
 */
async function getOrRefreshAccessToken(): Promise<string> {
  if (activeRefreshPromise) {
    return await activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      await tokenStorage.clearAll();
      sessionExpiredHandler?.();
      throw new ApiError('No refresh token available.', 401, 'no_refresh_token');
    }

    try {
      const result = await refreshAccessToken(refreshToken);
      await tokenStorage.updateAccessToken(result.access);
      return result.access;
    } catch (error) {
      // If refresh fails due to deactivation or invalid token, terminate session
      if (error instanceof ApiError && error.status === 401) {
        await tokenStorage.clearAll();
        sessionExpiredHandler?.();
      }
      throw error;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return await activeRefreshPromise;
}

/**
 * Authenticated fetch with automatic token injection and single-retry on 401 token expiry.
 */
export async function authenticatedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${normalizedPath}`;

  let accessToken = await tokenStorage.getAccessToken();

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError('Network connection error.', 0);
  }

  // Check if token expired (SimpleJWT returns 401 with code token_not_valid)
  if (response.status === 401) {
    const clone = response.clone();
    const data = await clone.json().catch(() => null);
    const isTokenExpired = data?.code === 'token_not_valid' || data?.code === 'token_expired';

    if (isTokenExpired) {
      // Attempt token refresh and retry ONCE
      try {
        accessToken = await getOrRefreshAccessToken();
        headers.set('Authorization', `Bearer ${accessToken}`);
        return await fetch(url, { ...options, headers });
      } catch (refreshError) {
        throw refreshError;
      }
    }
  }

  return response;
}


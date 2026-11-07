import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_ACCESS_TOKEN = 'veecleen_delivery_agent_access_token';
const KEY_REFRESH_TOKEN = 'veecleen_delivery_agent_refresh_token';
const KEY_USER_DATA = 'veecleen_delivery_agent_user';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: KEY_ACCESS_TOKEN,
  REFRESH_TOKEN: KEY_REFRESH_TOKEN,
  USER_DATA: KEY_USER_DATA,
} as const;

export interface StoredUserData {
  id: number;
  username: string;
  email: string;
  role: string;
  agent_id: string;
}

/**
 * Storage accessor for web platform fallback.
 *
 * SECURITY NOTICE (Development & Testing Environment):
 * On Web, `sessionStorage` is used to persist tokens across page reloads.
 * This storage mechanism is accessible to client-side JavaScript (and thus susceptible
 * to Cross-Site Scripting / XSS attacks) and does NOT provide hardware-backed
 * encryption equivalent to native mobile SecureStore (Android KeyStore / iOS Keychain)
 * or the security guarantees of production-grade HttpOnly cookies.
 * This fallback is intended exclusively for development, testing, and preview environments.
 */
function getWebStorage(): Storage | null {
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      return window.sessionStorage;
    } catch {
      // In private browsing or restricted iframes, accessing sessionStorage can throw
      return null;
    }
  }
  return null;
}

// In-memory fallback if sessionStorage is restricted or unavailable (e.g. SSR or strict iframe)
const memoryFallback = new Map<string, string>();

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    const webStorage = getWebStorage();
    if (webStorage) {
      try {
        webStorage.setItem(key, value);
        return;
      } catch {
        // Fallback to in-memory if storage quota is exceeded or access is restricted
      }
    }
    memoryFallback.set(key, value);
    return;
  }

  // Native Android and iOS use hardware-backed SecureStore
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const webStorage = getWebStorage();
    if (webStorage) {
      try {
        const item = webStorage.getItem(key);
        if (item !== null) {
          return item;
        }
      } catch {
        // Fallback to in-memory
      }
    }
    return memoryFallback.get(key) ?? null;
  }

  // Native Android and iOS
  return await SecureStore.getItemAsync(key);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    const webStorage = getWebStorage();
    if (webStorage) {
      try {
        webStorage.removeItem(key);
      } catch {
        // Fallback
      }
    }
    memoryFallback.delete(key);
    return;
  }

  // Native Android and iOS
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setSecureItem(KEY_ACCESS_TOKEN, accessToken),
      setSecureItem(KEY_REFRESH_TOKEN, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return await getSecureItem(KEY_ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return await getSecureItem(KEY_REFRESH_TOKEN);
  },

  async updateAccessToken(accessToken: string): Promise<void> {
    await setSecureItem(KEY_ACCESS_TOKEN, accessToken);
  },

  async saveUserData(user: StoredUserData): Promise<void> {
    await setSecureItem(KEY_USER_DATA, JSON.stringify(user));
  },

  async getUserData(): Promise<StoredUserData | null> {
    const raw = await getSecureItem(KEY_USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUserData;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      deleteSecureItem(KEY_ACCESS_TOKEN),
      deleteSecureItem(KEY_REFRESH_TOKEN),
      deleteSecureItem(KEY_USER_DATA),
    ]);
  },
};


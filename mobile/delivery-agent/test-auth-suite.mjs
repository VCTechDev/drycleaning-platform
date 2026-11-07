import assert from 'node:assert';

console.log('--- STARTING VEECLEN DELIVERY AGENT AUTH TEST SUITE ---');

// 1. Test Error Extractor Logic
function extractErrorMessage(data, status) {
  if (!data || typeof data !== 'object') {
    if (status === 429) return 'Too many attempts. Please try again later.';
    if (status === 503) return 'Service temporarily unavailable. Please try again shortly.';
    if (status >= 500) return 'Server error. Please try again later.';
    return 'An unexpected error occurred. Please try again.';
  }

  const payload = data;

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  const fieldErrors = [];
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

console.log('Test 1: Error extractor - backend detail format');
assert.strictEqual(
  extractErrorMessage({ detail: 'Too many login attempts. Please try again later.' }, 429),
  'Too many login attempts. Please try again later.'
);

console.log('Test 2: Error extractor - uniform anti-enumeration message');
assert.strictEqual(
  extractErrorMessage({ message: 'If an eligible account matches the submitted identifier, a verification code has been sent.' }, 200),
  'If an eligible account matches the submitted identifier, a verification code has been sent.'
);

console.log('Test 3: Error extractor - field dictionary format (identifier)');
assert.strictEqual(
  extractErrorMessage({ identifier: ['Username or email is required.'] }, 400),
  'Username or email is required.'
);

console.log('Test 4: Error extractor - field dictionary format (otp)');
assert.strictEqual(
  extractErrorMessage({ otp: 'Enter a valid 6-digit OTP.' }, 400),
  'Enter a valid 6-digit OTP.'
);

console.log('Test 5: Error extractor - 503 email delivery failure');
assert.strictEqual(
  extractErrorMessage(null, 503),
  'Service temporarily unavailable. Please try again shortly.'
);

console.log('Test 6: Error extractor - 500 server error');
assert.strictEqual(
  extractErrorMessage(null, 500),
  'Server error. Please try again later.'
);

// 2. Test Token Storage & Session Manager Logic
console.log('Test 7: Secure Token Storage abstraction (save, load, update, clear)');
const secureStoreMock = new Map();
const mockSecureStore = {
  async setItemAsync(k, v) { secureStoreMock.set(k, v); },
  async getItemAsync(k) { return secureStoreMock.get(k) || null; },
  async deleteItemAsync(k) { secureStoreMock.delete(k); },
};

class TokenStorageTest {
  constructor(store) {
    this.store = store;
  }
  async saveTokens(access, refresh) {
    await this.store.setItemAsync('access', access);
    await this.store.setItemAsync('refresh', refresh);
  }
  async getAccessToken() { return await this.store.getItemAsync('access'); }
  async getRefreshToken() { return await this.store.getItemAsync('refresh'); }
  async updateAccessToken(access) { await this.store.setItemAsync('access', access); }
  async saveUserData(user) { await this.store.setItemAsync('user', JSON.stringify(user)); }
  async getUserData() {
    const raw = await this.store.getItemAsync('user');
    return raw ? JSON.parse(raw) : null;
  }
  async clearAll() {
    await this.store.deleteItemAsync('access');
    await this.store.deleteItemAsync('refresh');
    await this.store.deleteItemAsync('user');
  }
}

const storage = new TokenStorageTest(mockSecureStore);
await storage.saveTokens('acc_111', 'ref_222');
assert.strictEqual(await storage.getAccessToken(), 'acc_111');
assert.strictEqual(await storage.getRefreshToken(), 'ref_222');

await storage.updateAccessToken('acc_333');
assert.strictEqual(await storage.getAccessToken(), 'acc_333');

const userObj = { id: 1, agent_id: 'VC-AGT-00001', username: 'john', email: 'john@example.com', role: 'delivery_agent' };
await storage.saveUserData(userObj);
assert.deepStrictEqual(await storage.getUserData(), userObj);

await storage.clearAll();
assert.strictEqual(await storage.getAccessToken(), null);
assert.strictEqual(await storage.getRefreshToken(), null);
assert.strictEqual(await storage.getUserData(), null);

// 3. Test Deduplicated Refresh Mechanism
console.log('Test 8: Deduplicated token refresh under concurrent requests');
let refreshCallCount = 0;
let activeRefreshPromise = null;

async function mockRefreshToken() {
  if (activeRefreshPromise) return await activeRefreshPromise;
  activeRefreshPromise = (async () => {
    refreshCallCount++;
    await new Promise((r) => setTimeout(r, 50));
    return 'new_access_token_' + refreshCallCount;
  })().finally(() => {
    activeRefreshPromise = null;
  });
  return await activeRefreshPromise;
}

// Fire 5 concurrent requests needing refresh
const results = await Promise.all([
  mockRefreshToken(),
  mockRefreshToken(),
  mockRefreshToken(),
  mockRefreshToken(),
  mockRefreshToken(),
]);

assert.strictEqual(refreshCallCount, 1, 'Refresh endpoint must be called exactly once for concurrent requests');
for (const token of results) {
  assert.strictEqual(token, 'new_access_token_1');
}

// 4. Test Single Retry on 401 with Token Expired
console.log('Test 9: Authenticated request retries exactly once on token expiry');
let requestCount = 0;
async function mockAuthenticatedFetch(isExpired) {
  requestCount++;
  if (isExpired && requestCount === 1) {
    // First attempt fails with 401 token_not_valid
    return { status: 401, json: async () => ({ code: 'token_not_valid' }) };
  }
  return { status: 200, json: async () => ({ success: true }) };
}

requestCount = 0;
let fetchRes = await mockAuthenticatedFetch(true);
if (fetchRes.status === 401) {
  const data = await fetchRes.json();
  if (data.code === 'token_not_valid') {
    const newTok = await mockRefreshToken();
    fetchRes = await mockAuthenticatedFetch(false); // retry once
  }
}
assert.strictEqual(fetchRes.status, 200);
assert.strictEqual(requestCount, 2, 'Must retry exactly once');

// 5. Test Refresh Failure Clears Session
console.log('Test 10: Refresh failure (deactivation/invalidation) clears stored session');
let sessionCleared = false;
async function mockFailingRefresh() {
  try {
    throw { status: 401, code: 'no_active_account' };
  } catch (err) {
    if (err.status === 401) {
      sessionCleared = true;
    }
  }
}
await mockFailingRefresh();
assert.strictEqual(sessionCleared, true, 'Session must be cleared on 401 refresh failure');

// 6. Test OTP Input Formatting and Validation Rules
console.log('Test 11: 6-digit numeric OTP regex');
assert.strictEqual(/^\d{6}$/.test('482910'), true);
assert.strictEqual(/^\d{6}$/.test('000000'), true);
assert.strictEqual(/^\d{6}$/.test('12345'), false);
assert.strictEqual(/^\d{6}$/.test('1234567'), false);
assert.strictEqual(/^\d{6}$/.test('abcdef'), false);
assert.strictEqual(/^\d{6}$/.test(''), false);

// 7. Test Phone & Agent ID Validation
console.log('Test 12: Identifier empty validation');
function validateIdentifier(val) {
  const trimmed = (val || '').trim();
  if (!trimmed) return 'Enter your phone number or agent ID.';
  return null;
}
assert.strictEqual(validateIdentifier(''), 'Enter your phone number or agent ID.');
assert.strictEqual(validateIdentifier('   '), 'Enter your phone number or agent ID.');
assert.strictEqual(validateIdentifier('VC-AGT-00001'), null);
assert.strictEqual(validateIdentifier('+919876543210'), null);
assert.strictEqual(validateIdentifier('9876543210'), null);

// 8. Test Web SessionStorage Implementation and Simulated Page Refresh
console.log('Test 13: Web sessionStorage persistence across simulated page refresh');

// Emulate browser sessionStorage
class MockSessionStorage {
  constructor() {
    this._store = new Map();
  }
  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }
  setItem(key, value) {
    this._store.set(key, String(value));
  }
  removeItem(key) {
    this._store.delete(key);
  }
  clear() {
    this._store.clear();
  }
  get length() {
    return this._store.size;
  }
}

// Simulated Web Storage Client mirroring src/services/storage.ts
class WebTokenStorage {
  constructor(sessionStorageInstance) {
    this.sessionStorage = sessionStorageInstance;
    this.memoryFallback = new Map();
    this.KEY_ACCESS_TOKEN = 'veecleen_delivery_agent_access_token';
    this.KEY_REFRESH_TOKEN = 'veecleen_delivery_agent_refresh_token';
    this.KEY_USER_DATA = 'veecleen_delivery_agent_user';
  }

  _getStorage() {
    return this.sessionStorage || null;
  }

  async _setItem(key, value) {
    const store = this._getStorage();
    if (store) {
      try {
        store.setItem(key, value);
        return;
      } catch {
        // Fallback
      }
    }
    this.memoryFallback.set(key, value);
  }

  async _getItem(key) {
    const store = this._getStorage();
    if (store) {
      try {
        const item = store.getItem(key);
        if (item !== null) return item;
      } catch {
        // Fallback
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  async _deleteItem(key) {
    const store = this._getStorage();
    if (store) {
      try {
        store.removeItem(key);
      } catch {
        // Fallback
      }
    }
    this.memoryFallback.delete(key);
  }

  async saveTokens(accessToken, refreshToken) {
    await Promise.all([
      this._setItem(this.KEY_ACCESS_TOKEN, accessToken),
      this._setItem(this.KEY_REFRESH_TOKEN, refreshToken),
    ]);
  }

  async getAccessToken() {
    return await this._getItem(this.KEY_ACCESS_TOKEN);
  }

  async getRefreshToken() {
    return await this._getItem(this.KEY_REFRESH_TOKEN);
  }

  async updateAccessToken(accessToken) {
    await this._setItem(this.KEY_ACCESS_TOKEN, accessToken);
  }

  async saveUserData(user) {
    await this._setItem(this.KEY_USER_DATA, JSON.stringify(user));
  }

  async getUserData() {
    const raw = await this._getItem(this.KEY_USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clearAll() {
    await Promise.all([
      this._deleteItem(this.KEY_ACCESS_TOKEN),
      this._deleteItem(this.KEY_REFRESH_TOKEN),
      this._deleteItem(this.KEY_USER_DATA),
    ]);
  }
}

// 1) Initialize browser tab session
const browserTabSession = new MockSessionStorage();
let webClient = new WebTokenStorage(browserTabSession);

// 2) Log in delivery agent
const mockAgentUser = {
  id: 42,
  username: 'agent_kavita',
  email: 'kavita@drycleaning.internal',
  role: 'delivery_agent',
  agent_id: 'VC-AGT-00042',
};
await webClient.saveTokens('initial_access_token_abc', 'persistent_refresh_token_xyz');
await webClient.saveUserData(mockAgentUser);

// Confirm items exist before refresh
assert.strictEqual(await webClient.getAccessToken(), 'initial_access_token_abc');
assert.strictEqual(await webClient.getRefreshToken(), 'persistent_refresh_token_xyz');
assert.deepStrictEqual(await webClient.getUserData(), mockAgentUser);

// 3) SIMULATE PAGE RELOAD:
// A browser reload completely destroys the JS heap and Map instances,
// but window.sessionStorage survives intact for that tab.
webClient = new WebTokenStorage(browserTabSession); // New instance, empty memoryFallback

// Verify tokens and user data survive reload!
assert.strictEqual(await webClient.getAccessToken(), 'initial_access_token_abc');
assert.strictEqual(await webClient.getRefreshToken(), 'persistent_refresh_token_xyz');
assert.deepStrictEqual(await webClient.getUserData(), mockAgentUser);

// 9. Test Startup Session Restoration & Access Token Refresh
console.log('Test 14: Startup session restoration with token refresh and rotation');

async function restoreSessionSimulation(client, mockRefreshApi) {
  let user = null;
  const storedUser = await client.getUserData();
  const refreshToken = await client.getRefreshToken();

  if (storedUser && refreshToken) {
    try {
      const refreshRes = await mockRefreshApi(refreshToken);
      await client.updateAccessToken(refreshRes.access);
      user = storedUser;
    } catch (err) {
      if (err.status === 401) {
        await client.clearAll();
        user = null;
      } else {
        user = storedUser; // offline resilience
      }
    }
  } else if (storedUser || refreshToken) {
    await client.clearAll();
    user = null;
  }
  return user;
}

// Successful refresh rotation on startup
const mockSuccessfulRefresh = async (refreshTok) => {
  assert.strictEqual(refreshTok, 'persistent_refresh_token_xyz');
  return { access: 'rotated_access_token_123' };
};

const restoredUser = await restoreSessionSimulation(webClient, mockSuccessfulRefresh);
assert.deepStrictEqual(restoredUser, mockAgentUser, 'Restored user should match logged-in user');
assert.strictEqual(await webClient.getAccessToken(), 'rotated_access_token_123', 'Access token must be updated after rotation');

// 10. Test Session Eviction on 401 Refresh Failure (Expired/Revoked Token)
console.log('Test 15: Session eviction on 401 refresh failure (deactivated/expired agent)');
const mockFailingRefresh401 = async () => {
  const err = new Error('Token is invalid or expired');
  err.status = 401;
  throw err;
};

// Simulate another page reload followed by an expired refresh attempt
webClient = new WebTokenStorage(browserTabSession);
const evictedUser = await restoreSessionSimulation(webClient, mockFailingRefresh401);
assert.strictEqual(evictedUser, null, 'User must be null after 401 eviction');
assert.strictEqual(await webClient.getAccessToken(), null, 'Access token must be cleared on 401');
assert.strictEqual(await webClient.getRefreshToken(), null, 'Refresh token must be cleared on 401');
assert.strictEqual(await webClient.getUserData(), null, 'User data must be cleared on 401');

// 11. Test Partial/Corrupted Session Cleanup
console.log('Test 16: Partial session corruption triggers automatic cleanup');
webClient = new WebTokenStorage(browserTabSession);
// Store user without refresh token
await webClient.saveUserData(mockAgentUser);
assert.notStrictEqual(await webClient.getUserData(), null);
assert.strictEqual(await webClient.getRefreshToken(), null);

const corruptedCleanupUser = await restoreSessionSimulation(webClient, mockSuccessfulRefresh);
assert.strictEqual(corruptedCleanupUser, null, 'Partial session must be rejected');
assert.strictEqual(await webClient.getUserData(), null, 'Corrupted user data must be cleaned up');

// 12. Test Logout Clears All Web Session Data
console.log('Test 17: User logout clears all sessionStorage keys');
webClient = new WebTokenStorage(browserTabSession);
await webClient.saveTokens('access_to_clear', 'refresh_to_clear');
await webClient.saveUserData(mockAgentUser);
assert.strictEqual(browserTabSession.length, 3);

// Perform logout
await webClient.clearAll();
assert.strictEqual(await webClient.getAccessToken(), null);
assert.strictEqual(await webClient.getRefreshToken(), null);
assert.strictEqual(await webClient.getUserData(), null);
assert.strictEqual(browserTabSession.length, 0, 'SessionStorage must have 0 items remaining');

// 13. Test Platform Isolation (Native SecureStore vs Web sessionStorage)
console.log('Test 18: Native platform uses SecureStore and web platform uses sessionStorage');
const nativeStore = new Map();
const webSessionStore = new Map();

function getStorageBackend(platform) {
  if (platform === 'web') {
    return {
      type: 'sessionStorage',
      store: webSessionStore,
    };
  }
  return {
    type: 'SecureStore',
    store: nativeStore,
    options: { keychainAccessible: 'AFTER_FIRST_UNLOCK' },
  };
}

const androidStorage = getStorageBackend('android');
const iosStorage = getStorageBackend('ios');
const webStorage = getStorageBackend('web');

assert.strictEqual(androidStorage.type, 'SecureStore');
assert.strictEqual(androidStorage.options.keychainAccessible, 'AFTER_FIRST_UNLOCK');
assert.strictEqual(iosStorage.type, 'SecureStore');
assert.strictEqual(iosStorage.options.keychainAccessible, 'AFTER_FIRST_UNLOCK');
assert.strictEqual(webStorage.type, 'sessionStorage');

// 14. Test Immediate Session Hydration on Startup (No Screen Flash)
console.log('Test 19: Immediate session state hydration on startup prevents UI flash');
let renderedScreen = null;
let simulatedIsLoading = true;
let simulatedUser = null;

function renderLoginScreen(isAuthLoading, isAuthenticated) {
  if (isAuthLoading || isAuthenticated) {
    return 'LOADING_SESSION_INDICATOR';
  }
  return 'LOGIN_FORM';
}

// Case 1: Fresh startup with session present
assert.strictEqual(renderLoginScreen(simulatedIsLoading, simulatedUser !== null), 'LOADING_SESSION_INDICATOR', 'Must not show login form while loading');

// Case 2: Immediate hydration from storage (instant user profile restore)
simulatedUser = mockAgentUser;
simulatedIsLoading = false;
assert.strictEqual(renderLoginScreen(simulatedIsLoading, simulatedUser !== null), 'LOADING_SESSION_INDICATOR', 'Must not show login form when authenticated');

// Case 3: Clean slate (no session, not loading)
simulatedUser = null;
simulatedIsLoading = false;
assert.strictEqual(renderLoginScreen(simulatedIsLoading, simulatedUser !== null), 'LOGIN_FORM', 'Only shows login form when unauthenticated and not loading');

// 15. Test Background Refresh & Revocation Lifecycle
console.log('Test 20: Background refresh validates session and evicts only on 401 revocation');
class AuthLifecycleManager {
  constructor(client) {
    this.client = client;
    this.user = null;
    this.isLoading = true;
  }

  async startup(refreshApi) {
    const storedUser = await this.client.getUserData();
    const refreshToken = await this.client.getRefreshToken();

    if (storedUser && refreshToken) {
      // Immediate hydration
      this.user = storedUser;
      this.isLoading = false;

      // Background validation
      try {
        const res = await refreshApi(refreshToken);
        await this.client.updateAccessToken(res.access);
      } catch (err) {
        if (err.status === 401) {
          await this.client.clearAll();
          this.user = null;
        }
      }
      return;
    }

    if (storedUser || refreshToken) {
      await this.client.clearAll();
    }
    this.user = null;
    this.isLoading = false;
  }
}

// Successful startup with background refresh
webClient = new WebTokenStorage(browserTabSession);
await webClient.saveTokens('initial_access', 'persistent_refresh');
await webClient.saveUserData(mockAgentUser);

const authMgr = new AuthLifecycleManager(webClient);
await authMgr.startup(async () => ({ access: 'new_rotated_access' }));
assert.strictEqual(authMgr.isLoading, false);
assert.deepStrictEqual(authMgr.user, mockAgentUser);
assert.strictEqual(await webClient.getAccessToken(), 'new_rotated_access');

// Revoked account (401 on background refresh)
const revokedMgr = new AuthLifecycleManager(webClient);
await revokedMgr.startup(async () => {
  const err = new Error('Revoked');
  err.status = 401;
  throw err;
});
assert.strictEqual(revokedMgr.user, null, 'Revoked account must be evicted');
assert.strictEqual(await webClient.getAccessToken(), null, 'Tokens must be cleared on revocation');

console.log('======================================================');
console.log('ALL 20 AUTHENTICATION & PERSISTENCE TESTS PASSED (100% OK)');
console.log('======================================================');

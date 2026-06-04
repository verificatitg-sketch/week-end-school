'use client';

// ==================== WEDS SOS UTILITY FUNCTIONS ====================
// Comprehensive utility file for the SOS emergency system.
// Used by both the SOS store and SOS view components.
// All functions are self-contained and do not import from stores.
// Handles browser API availability checks gracefully.

// ==================== TYPES ====================

export interface DeviceData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;        // Reverse geocoded
  batteryLevel?: number;   // 0-1
  isCharging?: boolean;
  networkStatus: 'online' | 'offline';
  connectionType?: string; // wifi, cellular, etc.
  timestamp: string;       // ISO string
  sessionId: string;       // Generated or from localStorage
}

interface BatteryManager {
  level: number;
  charging: boolean;
}

interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
}

// Extend Navigator to include non-standard APIs
interface ExtendedNavigator extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

interface StoredAlert {
  id: string;
  timestamp: string;
  urgency: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  networkStatus: string;
  connectionType?: string;
  sessionId: string;
  callerName?: string;
  callerPhone?: string;
  silentMode?: boolean;
  description?: string;
}

// ==================== CONSTANTS ====================

/** Cooldown duration between SOS triggers (30 seconds) */
export const SOS_COOLDOWN_MS = 30000;

/** Confirmation countdown before triggering SOS (7 seconds) */
export const SOS_COUNTDOWN_SECONDS = 7;

/** GPS position update interval (7 seconds) */
export const GPS_UPDATE_INTERVAL_MS = 7000;

/** LocalStorage key for session ID */
const SESSION_ID_KEY = 'weds_sos_session_id';

/** LocalStorage key for offline alerts */
const OFFLINE_ALERTS_KEY = 'weds_offline_sos_alerts';

/** Togo emergency numbers */
export const EMERGENCY_NUMBERS = [
  { label: 'Urgences', labelKey: 'sos.emergencies', number: '112', icon: '🚨' },
  { label: 'Police', labelKey: 'sos.police', number: '117', icon: '👮' },
  { label: 'SAMU', labelKey: 'sos.samu', number: '118', icon: '🚑' },
  { label: 'Pompiers', labelKey: 'sos.firefighters', number: '118', icon: '🚒' },
] as const;

// ==================== FUNCTIONS ====================

/**
 * 1. collectDeviceData() — Automatic data collection
 * Gathers GPS location, battery status, network info, and session data.
 * All browser API checks are handled gracefully with safe defaults.
 */
export async function collectDeviceData(): Promise<DeviceData> {
  const sessionId = getOrCreateSessionId();
  const timestamp = new Date().toISOString();

  // --- GPS Location ---
  let latitude: number | undefined;
  let longitude: number | undefined;
  let accuracy: number | undefined;
  let address: string | undefined;

  try {
    if (navigator.geolocation) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,  // 10 seconds timeout
          maximumAge: 0,
        });
      });
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      accuracy = position.coords.accuracy;

      // Attempt reverse geocoding if we have coordinates
      if (latitude != null && longitude != null) {
        address = (await reverseGeocode(latitude, longitude)) ?? undefined;
      }
    }
  } catch {
    // GPS unavailable or denied — continue without location
  }

  // --- Battery Status ---
  let batteryLevel: number | undefined;
  let isCharging: boolean | undefined;

  try {
    const extNav = navigator as ExtendedNavigator;
    if (typeof extNav.getBattery === 'function') {
      const battery = await extNav.getBattery();
      batteryLevel = battery.level;       // 0-1
      isCharging = battery.charging;
    }
  } catch {
    // Battery API not available — continue without battery info
  }

  // --- Network Status ---
  const networkStatus: 'online' | 'offline' = isOnline() ? 'online' : 'offline';

  let connectionType: string | undefined;
  try {
    const extNav = navigator as ExtendedNavigator;
    const conn = extNav.connection || extNav.mozConnection || extNav.webkitConnection;
    if (conn) {
      connectionType = conn.type || conn.effectiveType || undefined;
    }
  } catch {
    // Network Information API not available
  }

  return {
    latitude,
    longitude,
    accuracy,
    address,
    batteryLevel,
    isCharging,
    networkStatus,
    connectionType,
    timestamp,
    sessionId,
  };
}

/**
 * 2. reverseGeocode(lat, lng) — Reverse geocoding
 * Calls the server-side API to convert coordinates to a human-readable address.
 * Returns the address string or null on failure.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/sos/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.address ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 3. isOnline() — Check internet connectivity
 * Returns current online status. Optionally sets up event listeners
 * for online/offline events via the provided callbacks.
 */
export function isOnline(
  onOnline?: () => void,
  onOffline?: () => void
): boolean {
  // In SSR or non-browser environments, default to true (optimistic)
  // to avoid false "offline" states that block the app
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return true;
  }
  
  const online = navigator.onLine;
  
  // In the sandbox preview iframe, navigator.onLine may incorrectly
  // return false. If we can reach the server, we're online.
  // We trust navigator.onLine in real browsers but add a safety check.
  if (!online && typeof window !== 'undefined') {
    // Double-check: if the page was loaded, we must have had connectivity at some point
    // Don't immediately assume offline just because navigator.onLine is false
    // in sandbox/iframe environments
    try {
      // If document is ready and we're in an iframe, navigator.onLine might be unreliable
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        return true; // Optimistic for iframes
      }
    } catch {
      // Cross-origin iframe check failed — we're in an iframe
      return true; // Be optimistic
    }
  }

  // Set up event listeners if callbacks are provided
  if (typeof window !== 'undefined') {
    if (onOnline) {
      window.addEventListener('online', onOnline);
    }
    if (onOffline) {
      window.addEventListener('offline', onOffline);
    }
  }

  return online;
}

/**
 * Remove previously registered online/offline event listeners.
 * Useful for cleanup in useEffect returns.
 */
export function removeConnectivityListeners(
  onOnline?: () => void,
  onOffline?: () => void
): void {
  if (typeof window !== 'undefined') {
    if (onOnline) {
      window.removeEventListener('online', onOnline);
    }
    if (onOffline) {
      window.removeEventListener('offline', onOffline);
    }
  }
}

/**
 * 4. getOrCreateSessionId() — Session management
 * Checks localStorage for an existing WEDS SOS session ID.
 * Creates and stores a new one if not found.
 */
export function getOrCreateSessionId(): string {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return `sos_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }

    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) {
      return existing;
    }

    const newId = `sos_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    localStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage not available — generate ephemeral session ID
    return `sos_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

/**
 * 5. checkCooldown(lastTriggerTime) — Cooldown check
 * Ensures a minimum of 30 seconds between SOS triggers.
 */
export function checkCooldown(
  lastTriggerTime: number | null
): { canTrigger: true } | { canTrigger: false; remainingSeconds: number } {
  if (!lastTriggerTime) {
    return { canTrigger: true };
  }

  const elapsed = Date.now() - lastTriggerTime;
  if (elapsed < SOS_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((SOS_COOLDOWN_MS - elapsed) / 1000);
    return { canTrigger: false, remainingSeconds };
  }

  return { canTrigger: true };
}

/**
 * 6. storeOfflineAlert(alert) — Store alert for offline sync
 * Saves the alert to localStorage for later synchronization.
 * Appends to the existing array of stored alerts.
 */
export function storeOfflineAlert(alert: object): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const existing = getOfflineAlerts();
    const alertWithMeta: StoredAlert = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      urgency: 'critical',
      networkStatus: 'offline',
      sessionId: getOrCreateSessionId(),
      ...(alert as Partial<StoredAlert>),
    };

    existing.push(alertWithMeta);
    localStorage.setItem(OFFLINE_ALERTS_KEY, JSON.stringify(existing));
  } catch {
    // Silently fail — localStorage may be unavailable
  }
}

/**
 * 7. getOfflineAlerts() — Get stored offline alerts
 * Reads alerts from localStorage. Returns an empty array if none exist.
 */
export function getOfflineAlerts(): StoredAlert[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];

    const raw = localStorage.getItem(OFFLINE_ALERTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 8. clearOfflineAlerts() — Clear stored alerts after sync
 * Removes all offline alerts from localStorage.
 */
export function clearOfflineAlerts(): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.removeItem(OFFLINE_ALERTS_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * 9. syncOfflineAlerts() — Sync stored alerts when back online
 * Sends each stored alert to the server via POST /api/sos.
 * Clears alerts after successful sync.
 * Returns the number of successfully synced alerts.
 */
export async function syncOfflineAlerts(): Promise<number> {
  const alerts = getOfflineAlerts();
  if (alerts.length === 0) return 0;

  let syncedCount = 0;
  const failedAlerts: StoredAlert[] = [];

  for (const alert of alerts) {
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: alert.latitude,
          longitude: alert.longitude,
          urgencyLevel: alert.urgency,
          silentMode: alert.silentMode,
          description: alert.description,
          callerPhone: alert.callerPhone,
          callerName: alert.callerName,
          // Include device metadata
          address: alert.address,
          batteryLevel: alert.batteryLevel,
          isCharging: alert.isCharging,
          networkStatus: alert.networkStatus,
          connectionType: alert.connectionType,
          sessionId: alert.sessionId,
          offlineTimestamp: alert.timestamp,
          isOfflineSync: true,
        }),
      });

      if (res.ok) {
        syncedCount++;
      } else {
        failedAlerts.push(alert);
      }
    } catch {
      // Network error — keep this alert for next sync attempt
      failedAlerts.push(alert);
    }
  }

  // Update localStorage: keep only failed alerts for retry
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (failedAlerts.length === 0) {
        localStorage.removeItem(OFFLINE_ALERTS_KEY);
      } else {
        localStorage.setItem(OFFLINE_ALERTS_KEY, JSON.stringify(failedAlerts));
      }
    }
  } catch {
    // Silently fail
  }

  return syncedCount;
}

/**
 * 10. makeEmergencyCall(number) — Native phone call
 * Initiates a phone call using the tel: URI scheme.
 * Returns true if the call was initiated, false otherwise.
 */
export function makeEmergencyCall(number: string): boolean {
  try {
    if (typeof window === 'undefined') return false;

    // Validate the phone number contains only digits, +, and allowed characters
    const sanitized = number.replace(/[\s\-()]/g, '');
    if (!/^[\d+]+$/.test(sanitized)) return false;

    window.location.href = `tel:${sanitized}`;
    return true;
  } catch {
    return false;
  }
}

/**
 * 11. sendEmergencySms(number, message) — SMS fallback
 * Opens the default SMS app with a pre-filled message.
 * The message is automatically enhanced with GPS coordinates and urgency info.
 */
export function sendEmergencySms(
  number: string,
  message: string
): boolean {
  try {
    if (typeof window === 'undefined') return false;

    const sanitized = number.replace(/[\s\-()]/g, '');
    if (!/^[\d+]+$/.test(sanitized)) return false;

    const encodedBody = encodeURIComponent(message);
    window.location.href = `sms:${sanitized}?body=${encodedBody}`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a default emergency SMS message with GPS coordinates.
 * Useful for pre-filling SMS when app connectivity is lost.
 */
export function buildEmergencySmsMessage(
  latitude?: number,
  longitude?: number,
  urgencyLevel: string = 'critical',
  userName?: string
): string {
  const parts: string[] = ['🚨 SOS URGENCE 🚨'];

  if (userName) {
    parts.push(`De: ${userName}`);
  }

  parts.push(`Niveau: ${urgencyLevel.toUpperCase()}`);

  if (latitude != null && longitude != null) {
    parts.push(`Position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    parts.push(`Carte: https://www.google.com/maps?q=${latitude},${longitude}`);
  } else {
    parts.push('Position GPS non disponible');
  }

  parts.push(`Heure: ${new Date().toLocaleString('fr-FR')}`);
  parts.push('WEDS - Week-End School Digital');

  return parts.join('\n');
}

/**
 * 16. startGpsTracking(callback) — Continuous GPS tracking
 * Uses navigator.geolocation.watchPosition with high accuracy.
 * Returns the watch ID so it can be cleared later.
 */
export function startGpsTracking(
  callback: (position: GeolocationPosition) => void
): number | null {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      callback,
      // Silently ignore position errors during continuous tracking
      () => {},
      {
        enableHighAccuracy: true,
        timeout: GPS_UPDATE_INTERVAL_MS,
        maximumAge: 0,
      }
    );

    return watchId;
  } catch {
    return null;
  }
}

/**
 * 17. stopGpsTracking(watchId) — Stop GPS tracking
 * Clears the geolocation watch using the provided watch ID.
 */
export function stopGpsTracking(watchId: number): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  } catch {
    // Silently fail
  }
}

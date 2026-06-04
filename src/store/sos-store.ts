'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  collectDeviceData,
  checkCooldown,
  storeOfflineAlert,
  syncOfflineAlerts,
  SOS_COOLDOWN_MS,
  GPS_UPDATE_INTERVAL_MS,
} from '@/lib/sos-utils';

// ==================== TYPES ====================
export interface SosAdmin {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  role: string;
}

export interface SosCall {
  id: string;
  callerId: string;
  callerName: string;
  callerPhone?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  urgencyLevel: string;
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'timeout' | 'escalated';
  escalationLevel: number;
  batteryLevel?: number;
  networkStatus?: string;
  isAnonymous: boolean;
  sessionId?: string;
  assignedAdminId?: string;
  fallbackAdminId?: string;
  autoTriggered: boolean;
  createdAt: Date | string;
  acceptedAt?: Date | string;
  acceptedBy?: SosAdmin;
}

export interface SosChatMessage {
  id: string;
  callId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date | string;
  type: 'user' | 'system';
}

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  timestamp: Date | string;
}

export type SosCallerStatus =
  | 'idle'
  | 'confirming'   // Confirmation countdown active
  | 'calling'      // Sending alert
  | 'ringing'      // Waiting for operator
  | 'connected'    // In communication with operator
  | 'escalated'    // Escalated to fallback/external
  | 'rejected'
  | 'ended'
  | 'timeout'
  | 'offline';     // No internet - offline mode

interface SosState {
  // Socket
  socket: Socket | null;
  isConnected: boolean;

  // Admin list
  availableAdmins: SosAdmin[];
  adminsLoaded: boolean;

  // Caller state
  callerStatus: SosCallerStatus;
  currentCallId: string | null;
  currentCall: SosCall | null;
  countdownValue: number | null;  // Countdown timer value (null = not active)
  deviceData: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    address?: string;
    batteryLevel?: number;
    isCharging?: boolean;
    networkStatus: 'online' | 'offline';
    connectionType?: string;
    timestamp: string;
    sessionId: string;
  } | null;
  lastTriggerTime: number | null;
  escalationLevel: number;

  // GPS tracking
  gpsWatchId: number | null;
  gpsPositions: GpsPosition[];
  isGpsTracking: boolean;

  // Admin state
  incomingCalls: SosCall[];
  activeCallId: string | null;
  activeCall: SosCall | null;
  operatorGpsPositions: GpsPosition[];  // GPS positions from the caller (for admin view)

  // Chat
  messages: SosChatMessage[];

  // Offline mode
  isOfflineMode: boolean;
  offlineAlertStored: boolean;

  // Actions
  connect: (userId: string, userName: string, role: string) => void;
  disconnect: () => void;
  fetchAdmins: () => Promise<void>;

  // Caller actions
  startCountdown: () => void;
  cancelCountdown: () => void;
  triggerSos: (autoTriggered?: boolean) => Promise<void>;
  triggerOfflineSos: () => void;
  endCall: (endedBy: string) => void;
  sendChatMessage: (content: string, senderId: string, senderName: string) => void;
  sendGpsUpdate: (position: GpsPosition) => void;

  // GPS tracking
  startGpsTracking: () => void;
  stopGpsTracking: () => void;

  // WebRTC
  sendWebrtcOffer: (offer: RTCSessionDescriptionInit) => void;
  sendWebrtcAnswer: (answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void;

  // Admin actions
  acceptCall: (callId: string, adminId: string, adminName: string) => void;
  rejectCall: (callId: string, adminId: string, adminName: string) => void;
  setAdminAvailability: (available: boolean) => void;

  // Offline sync
  syncOfflineData: () => Promise<number>;

  // Reset
  resetCaller: () => void;
  resetAdmin: () => void;
}

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let gpsTrackingInterval: ReturnType<typeof setInterval> | null = null;

export const useSosStore = create<SosState>((set, get) => ({
  socket: null,
  isConnected: false,

  availableAdmins: [],
  adminsLoaded: false,

  callerStatus: 'idle',
  currentCallId: null,
  currentCall: null,
  countdownValue: null,
  deviceData: null,
  lastTriggerTime: null,
  escalationLevel: 0,

  gpsWatchId: null,
  gpsPositions: [],
  isGpsTracking: false,

  incomingCalls: [],
  activeCallId: null,
  activeCall: null,
  operatorGpsPositions: [],

  messages: [],

  isOfflineMode: false,
  offlineAlertStored: false,

  // ==================== FETCH ADMINS ====================
  fetchAdmins: async () => {
    if (get().adminsLoaded) return;
    try {
      const res = await fetch('/api/sos/admins');
      if (res.ok) {
        const data = await res.json();
        set({ availableAdmins: data.admins || [], adminsLoaded: true });
      }
    } catch {
      // Silently handle
    }
  },

  // ==================== CONNECT ====================
  connect: (userId: string, userName: string, role: string) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      set({ isConnected: true, isOfflineMode: false });
      socketInstance.emit('sos:register', { userId, userName, role });
      // Try to sync offline alerts
      get().syncOfflineData();
    });

    socketInstance.on('disconnect', () => {
      set({ isConnected: false });
    });

    // ==================== CALLER EVENTS ====================
    socketInstance.on('sos:call-started', (data: { callId: string; call: SosCall }) => {
      set({
        currentCallId: data.callId,
        currentCall: data.call,
        callerStatus: 'ringing',
        messages: [],
        escalationLevel: 0,
      });
    });

    socketInstance.on('sos:call-accepted', (data: { callId: string; adminName: string; adminId: string; call: SosCall; systemMessage: SosChatMessage }) => {
      set((state) => ({
        callerStatus: 'connected',
        currentCall: { ...data.call, acceptedBy: { id: data.adminId, name: data.adminName, phone: '', email: '', location: '', role: 'ADMIN' } },
        messages: [...state.messages, data.systemMessage],
        escalationLevel: 0,
      }));
      // Start GPS tracking when connected
      get().startGpsTracking();
    });

    socketInstance.on('sos:call-rejected', () => {
      set({ callerStatus: 'rejected' });
    });

    socketInstance.on('sos:call-ended', (data: { systemMessage: SosChatMessage }) => {
      set((state) => ({
        callerStatus: 'ended',
        messages: [...state.messages, data.systemMessage],
      }));
      get().stopGpsTracking();
    });

    socketInstance.on('sos:call-timeout', () => {
      set({ callerStatus: 'timeout' });
      get().stopGpsTracking();
    });

    socketInstance.on('sos:escalation', (data: { callId: string; escalationLevel: number; reason: string }) => {
      set((state) => ({
        escalationLevel: data.escalationLevel,
        callerStatus: data.escalationLevel >= 2 ? 'escalated' : state.callerStatus,
        messages: [...state.messages, {
          id: `sys-${Date.now()}`,
          callId: data.callId,
          senderId: 'system',
          senderName: 'Système',
          content: data.reason,
          timestamp: new Date(),
          type: 'system' as const,
        }],
      }));
    });

    socketInstance.on('sos:cooldown-active', (data: { remainingSeconds: number }) => {
      // Don't change status, just log it
      console.log(`[SOS] Cooldown active, ${data.remainingSeconds}s remaining`);
    });

    socketInstance.on('sos:request-gps', () => {
      // Server is requesting a GPS update
      get().startGpsTracking();
    });

    socketInstance.on('sos:caller-disconnected', () => {
      // Admin receives this when caller disconnects
    });

    socketInstance.on('sos:operator-disconnected', () => {
      // Caller receives this when operator disconnects
      set((state) => ({
        messages: [...state.messages, {
          id: `sys-${Date.now()}`,
          callId: state.currentCallId || '',
          senderId: 'system',
          senderName: 'Système',
          content: 'Opérateur déconnecté, réassignation en cours...',
          timestamp: new Date(),
          type: 'system' as const,
        }],
      }));
    });

    // ==================== ADMIN EVENTS ====================
    socketInstance.on('sos:incoming-call', (call: SosCall) => {
      set((state) => ({
        incomingCalls: [...state.incomingCalls.filter(c => c.id !== call.id), call],
      }));
    });

    socketInstance.on('sos:active-calls', (calls: SosCall[]) => {
      set({ incomingCalls: calls.filter(c => c.status === 'ringing') });
    });

    socketInstance.on('sos:call-taken', (data: { callId: string; adminName: string }) => {
      set((state) => ({
        incomingCalls: state.incomingCalls.filter(c => c.id !== data.callId),
      }));
    });

    socketInstance.on('sos:call-rejected-admin', (data: { callId: string }) => {
      set((state) => ({
        incomingCalls: state.incomingCalls.filter(c => c.id !== data.callId),
      }));
    });

    // Admin receives GPS updates from caller
    socketInstance.on('sos:gps-update', (data: GpsPosition & { callId: string }) => {
      set((state) => ({
        operatorGpsPositions: [...state.operatorGpsPositions.slice(-50), {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          speed: data.speed,
          timestamp: data.timestamp,
        }],
      }));
    });

    // ==================== CHAT EVENTS ====================
    socketInstance.on('sos:chat-message', (msg: SosChatMessage) => {
      set((state) => ({
        messages: [...state.messages, msg],
      }));
    });

    socketInstance.on('sos:messages-history', (data: { callId: string; messages: SosChatMessage[] }) => {
      set({ messages: data.messages });
    });

    // ==================== WEBRTC SIGNALING ====================
    socketInstance.on('sos:webrtc-offer', (data: { callId: string; offer: RTCSessionDescriptionInit; from: string }) => {
      // Admin receives offer from caller
      // The component will handle creating the RTCPeerConnection
      window.dispatchEvent(new CustomEvent('sos:webrtc-offer', { detail: data }));
    });

    socketInstance.on('sos:webrtc-answer', (data: { callId: string; answer: RTCSessionDescriptionInit; from: string }) => {
      // Caller receives answer from operator
      window.dispatchEvent(new CustomEvent('sos:webrtc-answer', { detail: data }));
    });

    socketInstance.on('sos:webrtc-ice-candidate', (data: { callId: string; candidate: RTCIceCandidateInit; from: string }) => {
      // Both parties receive ICE candidates
      window.dispatchEvent(new CustomEvent('sos:webrtc-ice-candidate', { detail: data }));
    });

    set({ socket: socketInstance });
  },

  // ==================== DISCONNECT ====================
  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
    }
    get().stopGpsTracking();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    set({
      socket: null,
      isConnected: false,
      callerStatus: 'idle',
      currentCallId: null,
      currentCall: null,
      countdownValue: null,
      deviceData: null,
      incomingCalls: [],
      activeCallId: null,
      activeCall: null,
      messages: [],
      gpsPositions: [],
      operatorGpsPositions: [],
      isGpsTracking: false,
      escalationLevel: 0,
      isOfflineMode: false,
      offlineAlertStored: false,
    });
  },

  // ==================== COUNTDOWN ====================
  startCountdown: () => {
    // Check cooldown first
    const cooldownCheck = checkCooldown(get().lastTriggerTime);
    if (!cooldownCheck.canTrigger) {
      console.log(`[SOS] Cooldown active, ${cooldownCheck.remainingSeconds}s remaining`);
      return;
    }

    set({ callerStatus: 'confirming', countdownValue: 7 });

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      const current = get().countdownValue;
      if (current === null || current <= 1) {
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        // Auto-trigger SOS when countdown reaches 0
        set({ countdownValue: 0 });
        get().triggerSos(true);
      } else {
        set({ countdownValue: current - 1 });
      }
    }, 1000);
  },

  cancelCountdown: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    set({ callerStatus: 'idle', countdownValue: null });
  },

  // ==================== TRIGGER SOS ====================
  triggerSos: async (autoTriggered = false) => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Check cooldown
    const cooldownCheck = checkCooldown(get().lastTriggerTime);
    if (!cooldownCheck.canTrigger) return;

    set({ callerStatus: 'calling', lastTriggerTime: Date.now(), countdownValue: null });

    // Collect device data automatically
    try {
      const data = await collectDeviceData();
      set({ deviceData: data });

      // Check if offline
      if (data.networkStatus === 'offline') {
        set({ isOfflineMode: true, callerStatus: 'offline' });
        get().triggerOfflineSos();
        return;
      }
    } catch {
      // Continue even if data collection fails
    }

    const deviceData = get().deviceData;
    const socket = get().socket;

    // Connect socket if not connected
    if (!socket?.connected) {
      // For anonymous users, connect with session ID
      const sessionId = deviceData?.sessionId || `sos_${Date.now()}`;
      get().connect(sessionId, 'Utilisateur SOS', 'BENEFICIAIRE');
      // Wait a moment for connection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const connectedSocket = get().socket;
    if (!connectedSocket?.connected) {
      // Fallback to offline mode
      set({ isOfflineMode: true, callerStatus: 'offline' });
      get().triggerOfflineSos();
      return;
    }

    // Save to database
    let dbAlertId: string | undefined;
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency: 'critical',
          silent: false,
          latitude: deviceData?.latitude,
          longitude: deviceData?.longitude,
          address: deviceData?.address,
          batteryLevel: deviceData?.batteryLevel,
          isCharging: deviceData?.isCharging,
          networkStatus: deviceData?.networkStatus,
          connectionType: deviceData?.connectionType,
          sessionId: deviceData?.sessionId,
          autoTriggered,
          isAnonymous: !deviceData?.sessionId?.startsWith('user_'),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        dbAlertId = data.alert?.id || data.id;
      }
    } catch {
      // Continue even if DB save fails
    }

    // Emit SOS call via WebSocket
    connectedSocket.emit('sos:call', {
      callerId: deviceData?.sessionId || 'anonymous',
      callerName: 'Utilisateur SOS',
      latitude: deviceData?.latitude,
      longitude: deviceData?.longitude,
      address: deviceData?.address,
      urgencyLevel: 'critical',
      batteryLevel: deviceData?.batteryLevel,
      networkStatus: deviceData?.networkStatus,
      isAnonymous: !deviceData?.sessionId?.startsWith('user_'),
      sessionId: deviceData?.sessionId,
      autoTriggered,
    });

    // Start GPS tracking
    get().startGpsTracking();
  },

  // ==================== OFFLINE SOS ====================
  triggerOfflineSos: () => {
    const deviceData = get().deviceData;
    // Store alert locally for later sync
    storeOfflineAlert({
      urgency: 'critical',
      latitude: deviceData?.latitude,
      longitude: deviceData?.longitude,
      address: deviceData?.address,
      batteryLevel: deviceData?.batteryLevel,
      networkStatus: 'offline',
      timestamp: new Date().toISOString(),
      sessionId: deviceData?.sessionId,
      autoTriggered: false,
    });
    set({ offlineAlertStored: true });
  },

  // ==================== GPS TRACKING ====================
  startGpsTracking: () => {
    if (get().isGpsTracking) return;

    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos: GpsPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          timestamp: new Date(),
        };

        set((state) => ({
          gpsPositions: [...state.gpsPositions.slice(-100), pos],
          isGpsTracking: true,
        }));

        // Send GPS update to server
        get().sendGpsUpdate(pos);
      },
      () => {
        // GPS error - silently handle
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    set({ gpsWatchId: watchId, isGpsTracking: true });
  },

  stopGpsTracking: () => {
    const watchId = get().gpsWatchId;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    if (gpsTrackingInterval) {
      clearInterval(gpsTrackingInterval);
      gpsTrackingInterval = null;
    }
    set({ gpsWatchId: null, isGpsTracking: false });
  },

  sendGpsUpdate: (position: GpsPosition) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:gps-update', { callId, ...position });
  },

  // ==================== WEBRTC ====================
  sendWebrtcOffer: (offer: RTCSessionDescriptionInit) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:webrtc-offer', { callId, offer });
  },

  sendWebrtcAnswer: (answer: RTCSessionDescriptionInit) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:webrtc-answer', { callId, answer });
  },

  sendIceCandidate: (candidate: RTCIceCandidateInit) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:webrtc-ice-candidate', { callId, candidate });
  },

  // ==================== CALLER ACTIONS ====================
  endCall: (endedBy: string) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:end-call', { callId, endedBy });
    get().stopGpsTracking();
    set((state) => ({
      callerStatus: state.callerStatus !== 'idle' ? 'ended' : 'idle',
      currentCallId: null,
      currentCall: null,
      activeCallId: null,
      activeCall: null,
    }));
  },

  sendChatMessage: (content: string, senderId: string, senderName: string) => {
    const socket = get().socket;
    const callId = get().currentCallId || get().activeCallId;
    if (!socket?.connected || !callId) return;
    socket.emit('sos:chat-message', { callId, senderId, senderName, content });
  },

  // ==================== ADMIN ACTIONS ====================
  acceptCall: (callId: string, adminId: string, adminName: string) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    socket.emit('sos:accept-call', { callId, adminId, adminName });
    set({
      activeCallId: callId,
      incomingCalls: get().incomingCalls.filter(c => c.id !== callId),
      messages: [],
      operatorGpsPositions: [],
    });
  },

  rejectCall: (callId: string, adminId: string, adminName: string) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    socket.emit('sos:reject-call', { callId, adminId, adminName });
    set({
      incomingCalls: get().incomingCalls.filter(c => c.id !== callId),
    });
  },

  setAdminAvailability: (available: boolean) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    socket.emit('sos:set-availability', { available });
  },

  // ==================== OFFLINE SYNC ====================
  syncOfflineData: async () => {
    try {
      const count = await syncOfflineAlerts();
      if (count > 0) {
        set({ offlineAlertStored: false });
      }
      return count;
    } catch {
      return 0;
    }
  },

  // ==================== RESET ====================
  resetCaller: () => {
    get().stopGpsTracking();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    set({
      callerStatus: 'idle',
      currentCallId: null,
      currentCall: null,
      countdownValue: null,
      deviceData: null,
      messages: [],
      gpsPositions: [],
      escalationLevel: 0,
      isOfflineMode: false,
      offlineAlertStored: false,
    });
  },

  resetAdmin: () => {
    set({
      activeCallId: null,
      activeCall: null,
      messages: [],
      operatorGpsPositions: [],
    });
  },
}));

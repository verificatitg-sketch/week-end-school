'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSosStore, SosCall, GpsPosition } from '@/store/sos-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  MapPin,
  MessageCircle,
  Send,
  Siren,
  ShieldCheck,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Shield,
  Copy,
  Volume2,
  VolumeX,
  Wifi,
  Battery,
  Radio,
} from 'lucide-react';

// ==================== ADMIN INCOMING CALL NOTIFICATION ====================
export function SosAdminIncomingCall({ call }: { call: SosCall }) {
  const { acceptCall, rejectCall } = useSosStore();
  const user = useAuthStore((s) => s.user);
  const [rejecting, setRejecting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [ringCount, setRingCount] = useState(0);

  const adminId = user?.id || 'admin';
  const adminName = user?.name || 'Administrateur';

  // Ring animation
  useEffect(() => {
    const interval = setInterval(() => setRingCount(prev => prev + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = () => {
    acceptCall(call.id, adminId, adminName);
  };

  const handleReject = () => {
    setRejecting(true);
    rejectCall(call.id, adminId, adminName);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(adminId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Pulsing header */}
        <div className="bg-red-600 text-white p-5 text-center relative">
          <div className="absolute inset-0 bg-red-500 animate-pulse opacity-50" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
              <PhoneIncoming className="h-8 w-8" />
            </div>
            <h2 className="font-bold text-xl">APPEL SOS ENTRANT</h2>
            <p className="text-red-100 text-sm">Une personne a besoin d&apos;aide !</p>
          </div>
        </div>

        {/* Admin ID Card */}
        <div className="bg-weds-blue-50 border-b border-weds-blue-100 p-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-weds-blue shrink-0" />
            <p className="text-[10px] text-weds-blue font-medium">Votre ID opérateur :</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-weds-blue-700 font-mono font-bold truncate flex-1">
              {adminId}
            </p>
            <button
              onClick={handleCopyId}
              className="text-weds-blue hover:text-weds-blue-700 transition shrink-0 p-1"
              aria-label="Copier votre ID opérateur"
            >
              {copiedId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[9px] text-weds-blue mt-0.5">
            Connecté en tant que : {adminName}
          </p>
        </div>

        {/* Caller info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-weds-red-50 rounded-lg">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">{call.callerName}</p>
              {call.callerPhone && (
                <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
              )}
            </div>
            <Badge className="bg-red-100 text-red-800 border-0 ml-auto">
              {call.urgencyLevel === 'critical' ? 'CRITIQUE' : call.urgencyLevel.toUpperCase()}
            </Badge>
          </div>

          {/* Location */}
          {call.latitude && call.longitude && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-700">
                Position: {call.latitude.toFixed(4)}, {call.longitude.toFixed(4)}
              </span>
            </div>
          )}

          {/* Address */}
          {call.address && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
              <Radio className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700">{call.address}</span>
            </div>
          )}

          {/* Device info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {call.batteryLevel !== undefined && (
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {Math.round(call.batteryLevel * 100)}%
              </span>
            )}
            {call.networkStatus && (
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {call.networkStatus}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(call.createdAt).toLocaleString('fr-FR')}
            </span>
          </div>

          {/* Auto-triggered indicator */}
          {call.autoTriggered && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
              <p className="text-xs font-semibold text-amber-700">
                ⚠️ Alerte déclenchée automatiquement (compte à rebours expiré)
              </p>
            </div>
          )}

          {/* Escalation level */}
          {call.escalationLevel > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
              <p className="text-xs font-semibold text-red-700">
                🚨 Escalade niveau {call.escalationLevel} - Intervention urgente requise
              </p>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="space-y-3 pt-2">
            {/* ACCEPT BUTTON */}
            <button
              onClick={handleAccept}
              className="w-full py-4 bg-gradient-to-b from-weds-blue-600 to-weds-blue text-white rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-weds-blue/30 hover:shadow-weds-blue/50 hover:scale-[1.02] active:scale-95 transition-all font-bold text-lg cursor-pointer"
              aria-label="Accepter l'appel SOS"
            >
              <CheckCircle2 className="h-7 w-7" />
              <div className="text-left">
                <p className="font-black text-lg leading-tight">ACCEPTER</p>
                <p className="text-[10px] text-weds-blue-100">Prendre en charge l&apos;appel</p>
              </div>
            </button>

            {/* REJECT BUTTON */}
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm cursor-pointer"
              aria-label="Rejeter l'appel SOS"
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN ACTIVE CALL (with GPS & Audio) ====================
export function SosAdminActiveCall() {
  const { activeCall, activeCallId, messages, sendChatMessage, endCall, operatorGpsPositions, sendWebrtcOffer, sendIceCandidate } = useSosStore();
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [chatInput, setChatInput] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const adminId = user?.id || 'admin';
  const adminName = user?.name || 'Administrateur';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebRTC: Listen for signaling events
  useEffect(() => {
    const handleOffer = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendIceCandidate(event.candidate.toJSON());
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWebrtcOffer(answer); // Using the same function for answer
        setPeerConnection(pc);
      } catch {
        // Audio not available
      }
    };

    const handleIceCandidate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    window.addEventListener('sos:webrtc-offer', handleOffer);
    window.addEventListener('sos:webrtc-ice-candidate', handleIceCandidate);

    return () => {
      window.removeEventListener('sos:webrtc-offer', handleOffer);
      window.removeEventListener('sos:webrtc-ice-candidate', handleIceCandidate);
    };
  }, [peerConnection, sendWebrtcOffer, sendIceCandidate]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), adminId, adminName);
    setChatInput('');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(adminId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const startAudioCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendIceCandidate(event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWebrtcOffer(offer);
      setPeerConnection(pc);
    } catch {
      // Audio not available
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  if (!activeCallId) return null;

  const latestGps = operatorGpsPositions[operatorGpsPositions.length - 1];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-weds-blue text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Appel SOS en cours</h2>
              <p className="text-weds-blue-100 text-xs">{activeCall?.callerName || 'Victime'}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={startAudioCall}
            >
              <Phone className="h-4 w-4" />
            </Button>
            {localStream && (
              <Button
                variant="ghost"
                size="icon"
                className={`text-white hover:bg-white/20 h-8 w-8 ${isMuted ? 'bg-red-500/50' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-500/50 h-8 gap-1"
              onClick={() => endCall(adminId)}
            >
              <PhoneOff className="h-4 w-4" />
              Fin
            </Button>
          </div>
        </div>

        {/* Operator ID + GPS info */}
        <div className="p-3 bg-weds-blue-50 border-b border-weds-blue-100 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-weds-blue" />
              <span className="text-[10px] text-weds-blue font-medium">Votre ID :</span>
              <span className="text-[10px] text-weds-blue-700 font-mono font-bold">{adminId}</span>
            </div>
            <button
              onClick={handleCopyId}
              className="text-weds-blue hover:text-weds-blue-700 transition"
              aria-label="Copier votre ID opérateur"
            >
              {copiedId ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          {/* Live GPS */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-weds-blue shrink-0" />
            {latestGps ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-weds-blue-700">
                  Position: {latestGps.latitude.toFixed(4)}, {latestGps.longitude.toFixed(4)}
                </span>
                <Badge className="bg-green-100 text-green-700 border-0 text-[9px] animate-pulse">
                  GPS LIVE
                </Badge>
              </div>
            ) : activeCall?.latitude ? (
              <span className="text-xs text-weds-blue-700">
                Dernière position: {activeCall.latitude.toFixed(4)}, {activeCall.longitude?.toFixed(4)}
              </span>
            ) : (
              <span className="text-xs text-weds-blue-700">Position non disponible</span>
            )}
          </div>
          {/* Address */}
          {activeCall?.address && (
            <div className="text-[10px] text-weds-blue-600">
              📍 {activeCall.address}
            </div>
          )}
        </div>

        {/* GPS Tracking Map (Simple) */}
        {showMap && latestGps && (
          <div className="border-b shrink-0">
            <div className="bg-gray-100 p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-red-600" />
                <span className="text-xs font-semibold text-gray-700">Suivi GPS en temps réel</span>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Latitude</p>
                    <p className="font-mono font-bold">{latestGps.latitude.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Longitude</p>
                    <p className="font-mono font-bold">{latestGps.longitude.toFixed(6)}</p>
                  </div>
                  {latestGps.accuracy && (
                    <div>
                      <p className="text-muted-foreground">Précision</p>
                      <p className="font-mono">{Math.round(latestGps.accuracy)}m</p>
                    </div>
                  )}
                  {latestGps.speed && latestGps.speed > 0 && (
                    <div>
                      <p className="text-muted-foreground">Vitesse</p>
                      <p className="font-mono">{(latestGps.speed * 3.6).toFixed(1)} km/h</p>
                    </div>
                  )}
                </div>
                {/* OpenStreetMap link */}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${latestGps.latitude}&mlon=${latestGps.longitude}#map=16/${latestGps.latitude}/${latestGps.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-weds-blue hover:underline"
                >
                  Ouvrir sur la carte →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-3" style={{ maxHeight: '300px' }}>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === adminId ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.type === 'system'
                      ? 'bg-muted text-muted-foreground text-xs italic text-center'
                      : msg.senderId === adminId
                        ? 'bg-weds-blue text-white rounded-br-sm'
                        : 'bg-red-100 text-red-800 rounded-bl-sm'
                  }`}
                >
                  {msg.type !== 'system' && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.senderName}</p>
                  )}
                  <p>{msg.content}</p>
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className="p-3 border-t shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Répondre à la victime..."
              className="flex-1 h-9 text-sm"
            />
            <Button type="submit" size="sm" className="bg-weds-blue hover:bg-weds-blue-700 h-9 w-9 p-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

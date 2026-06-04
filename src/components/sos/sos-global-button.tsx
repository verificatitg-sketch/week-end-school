'use client';

import React, { useState, useEffect } from 'react';
import { useSosStore } from '@/store/sos-store';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { EMERGENCY_NUMBERS, makeEmergencyCall, sendEmergencySms, buildEmergencySmsMessage, SOS_COUNTDOWN_SECONDS } from '@/lib/sos-utils';
import { Button } from '@/components/ui/button';
import {
  Siren,
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  PhoneMissed,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Send,
  WifiOff,
  X,
  Clock,
  Shield,
  CheckCircle2,
  Volume2,
  VolumeX,
  AlertTriangle,
  Battery,
  Wifi,
  WifiOff as OfflineIcon,
  Copy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// ==================== GLOBAL SOS FLOATING BUTTON ====================
export function GlobalSosButton() {
  const { callerStatus, startCountdown, isConnected } = useSosStore();
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // On mobile, the SOS button is already in the BottomTabBar — don't show floating button
  // Don't show during active call states (those have their own UI)
  const hideButton = isMobile || ['confirming', 'calling', 'ringing', 'connected'].includes(callerStatus);

  if (hideButton) return null;

  return (
    <>
      {/* Floating SOS button - always visible */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-4 z-50 w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 text-white rounded-full shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300 flex flex-col items-center justify-center animate-sos-pulse cursor-pointer"
        aria-label="SOS Urgence"
      >
        <Siren className="h-7 w-7" />
        <span className="text-[9px] font-black mt-0.5">SOS</span>
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20" />
      </button>

      {/* SOS Modal */}
      {showModal && (
        <SosModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ==================== SOS MODAL (Confirmation + All States) ====================
function SosModal({ onClose }: { onClose: () => void }) {
  const {
    callerStatus,
    countdownValue,
    currentCall,
    currentCallId,
    messages,
    deviceData,
    escalationLevel,
    isOfflineMode,
    offlineAlertStored,
    gpsPositions,
    startCountdown,
    cancelCountdown,
    triggerSos,
    triggerOfflineSos,
    endCall,
    sendChatMessage,
    resetCaller,
    sendWebrtcOffer,
    sendIceCandidate,
  } = useSosStore();

  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [copiedAdminId, setCopiedAdminId] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const [offlineCountdown, setOfflineCountdown] = useState(5);
  const [offlineAutoCall, setOfflineAutoCall] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Offline auto-call countdown
  useEffect(() => {
    if (callerStatus !== 'offline' || offlineAutoCall) return;
    const interval = setInterval(() => {
      setOfflineCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setOfflineAutoCall(true);
          makeEmergencyCall('112');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [callerStatus, offlineAutoCall]);

  // WebRTC: Listen for signaling events
  useEffect(() => {
    const handleAnswer = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleIceCandidate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    window.addEventListener('sos:webrtc-answer', handleAnswer);
    window.addEventListener('sos:webrtc-ice-candidate', handleIceCandidate);

    return () => {
      window.removeEventListener('sos:webrtc-answer', handleAnswer);
      window.removeEventListener('sos:webrtc-ice-candidate', handleIceCandidate);
    };
  }, [peerConnection]);

  // Start audio call with WebRTC
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
      // Audio not available, continue with chat only
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

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), user?.id || deviceData?.sessionId || 'anonymous', user?.name || 'Victime');
    setChatInput('');
  };

  const handleCopyAdminId = () => {
    if (currentCall?.acceptedBy?.id) {
      navigator.clipboard.writeText(currentCall.acceptedBy.id);
      setCopiedAdminId(true);
      setTimeout(() => setCopiedAdminId(false), 2000);
    }
  };

  const handleEmergencyCall = (number: string) => {
    makeEmergencyCall(number);
  };

  const handleEmergencySms = (number: string) => {
    const msg = buildEmergencySmsMessage(
      deviceData?.latitude,
      deviceData?.longitude,
      'critical'
    );
    sendEmergencySms(number, msg);
  };

  // ==================== RENDER BASED ON STATE ====================
  const renderContent = () => {
    switch (callerStatus) {
      // ==================== IDLE - Confirmation Screen ====================
      case 'idle':
        return (
          <div className="flex flex-col items-center py-6 space-y-6">
            {/* Big SOS button */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Appuyez pour déclencher une alerte</p>
            </div>
            <button
              onClick={startCountdown}
              className="relative w-44 h-44 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300 cursor-pointer"
              aria-label="Déclencher SOS"
            >
              <Phone className="h-10 w-10 mb-2" />
              <span className="text-2xl font-black">SOS</span>
              <span className="text-xs font-medium mt-1">URGENCE</span>
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20" />
            </button>

            {/* Fallback: Emergency numbers */}
            <div className="w-full space-y-2">
              <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 justify-center">
                <WifiOff className="h-3 w-3" />
                Sans connexion ? Appelez directement :
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCY_NUMBERS.map((em) => (
                  <a
                    key={em.label}
                    href={`tel:${em.number}`}
                    className="flex items-center gap-2 p-2.5 bg-amber-50 text-amber-800 rounded-lg text-xs hover:bg-amber-100 transition"
                    onClick={(e) => { e.preventDefault(); handleEmergencyCall(em.number); }}
                  >
                    <span className="text-lg">{em.icon}</span>
                    <div>
                      <p className="font-bold">{em.number}</p>
                      <p className="text-[9px]">{em.label}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        );

      // ==================== CONFIRMING - Countdown ====================
      case 'confirming':
        return (
          <div className="flex flex-col items-center py-8 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-red-600">CONFIRMER L&apos;ALERTE SOS</p>
              <p className="text-sm text-muted-foreground">L&apos;alerte se déclenchera automatiquement</p>
            </div>

            {/* Countdown circle */}
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#fee2e2" strokeWidth="8" />
                <circle
                  cx="80" cy="80" r="70" fill="none" stroke="#ef4444" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - (countdownValue || 0) / SOS_COUNTDOWN_SECONDS)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-red-600">{countdownValue}</span>
                <span className="text-xs text-red-500">secondes</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 w-full max-w-xs">
              <button
                onClick={() => triggerSos(false)}
                className="flex-1 py-4 bg-gradient-to-b from-red-600 to-red-700 text-white rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg hover:shadow-red-500/50 active:scale-95 transition-all cursor-pointer"
              >
                <AlertTriangle className="h-6 w-6" />
                <span className="font-black text-sm">URGENCE</span>
              </button>
              <button
                onClick={cancelCountdown}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <X className="h-6 w-6" />
                <span className="font-bold text-sm">ANNULER</span>
              </button>
            </div>
          </div>
        );

      // ==================== CALLING ====================
      case 'calling':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <PhoneCall className="h-10 w-10 text-white" />
            </div>
            <p className="text-lg font-bold text-red-600">Envoi de l&apos;alerte SOS...</p>
            <p className="text-sm text-muted-foreground">Collecte des données en cours</p>
          </div>
        );

      // ==================== RINGING ====================
      case 'ringing':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="relative">
              <div className="w-28 h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center animate-pulse">
                <PhoneIncoming className="h-12 w-12 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
              <div className="absolute -inset-4 rounded-full border-2 border-red-300 animate-ping opacity-20" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-red-600">Appel en cours...</p>
              <p className="text-sm text-muted-foreground">En attente d&apos;un opérateur</p>
              {deviceData?.latitude && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>GPS: {deviceData.latitude.toFixed(4)}, {deviceData.longitude?.toFixed(4)}</span>
                </div>
              )}
              {deviceData?.address && (
                <p className="text-xs text-muted-foreground">{deviceData.address}</p>
              )}
            </div>

            {/* Device info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {deviceData?.batteryLevel !== undefined && (
                <span className="flex items-center gap-1">
                  <Battery className="h-3 w-3" />
                  {Math.round(deviceData.batteryLevel * 100)}%
                </span>
              )}
              <span className="flex items-center gap-1">
                {deviceData?.networkStatus === 'online' ? <Wifi className="h-3 w-3" /> : <OfflineIcon className="h-3 w-3" />}
                {deviceData?.networkStatus === 'online' ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            {/* Escalation info */}
            {escalationLevel > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                <p className="text-xs font-semibold text-amber-700">
                  ⚠️ Escalade niveau {escalationLevel} - {escalationLevel === 1 ? 'Réassignation en cours' : 'Services externes sollicités'}
                </p>
              </div>
            )}

            <Button variant="destructive" className="gap-2" onClick={() => endCall(user?.id || 'caller')}>
              <PhoneOff className="h-4 w-4" />
              Annuler l&apos;appel
            </Button>
          </div>
        );

      // ==================== CONNECTED ====================
      case 'connected':
        return (
          <div className="flex flex-col h-full min-h-[400px]">
            {/* Connected header */}
            <div className="bg-weds-blue text-white p-3 flex items-center justify-between rounded-t-xl shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">Connecté à l&apos;opérateur</p>
                  <p className="text-[10px] text-weds-blue-100">Communication établie</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-8 w-8"
                  onClick={startAudioCall}
                  aria-label="Appel vocal"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-8 w-8"
                  onClick={() => setShowChat(!showChat)}
                  aria-label="Chat"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                {localStream && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-white hover:bg-white/20 h-8 w-8 ${isMuted ? 'bg-red-500/50' : ''}`}
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Activer le micro' : 'Couper le micro'}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-red-500/50 h-8 w-8"
                  onClick={() => endCall(user?.id || 'caller')}
                  aria-label="Raccrocher"
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Operator info */}
            {currentCall?.acceptedBy && (
              <div className="bg-weds-blue-50 border-b border-weds-blue-100 p-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-weds-blue rounded-full flex items-center justify-center text-white shrink-0">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-weds-blue-700">{currentCall.acceptedBy.name}</p>
                      <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0 text-[9px] px-1.5 py-0">
                        Opérateur
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[10px] text-weds-blue font-mono truncate">
                        ID: {currentCall.acceptedBy.id}
                      </p>
                      <button
                        onClick={handleCopyAdminId}
                        className="text-weds-blue hover:text-weds-blue-700 transition shrink-0"
                        aria-label="Copier l'ID opérateur"
                      >
                        {copiedAdminId ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GPS info */}
            {deviceData?.latitude && (
              <div className="bg-green-50 border-b border-green-100 p-2 flex items-center gap-2 text-xs text-green-700 shrink-0">
                <MapPin className="h-3 w-3" />
                <span>Position: {deviceData.latitude.toFixed(4)}, {deviceData.longitude?.toFixed(4)}</span>
                {gpsPositions.length > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-0 text-[9px] ml-auto">
                    GPS actif
                  </Badge>
                )}
              </div>
            )}

            {/* Chat area */}
            {showChat ? (
              <div className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 p-3" style={{ maxHeight: '250px' }}>
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === (user?.id || deviceData?.sessionId || 'anonymous') ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                            msg.type === 'system'
                              ? 'bg-muted text-muted-foreground text-xs italic text-center'
                              : msg.senderId === (user?.id || deviceData?.sessionId || 'anonymous')
                                ? 'bg-red-600 text-white rounded-br-sm'
                                : 'bg-weds-blue-100 text-weds-blue-700 rounded-bl-sm'
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
                <div className="p-2 border-t">
                  <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Écrire un message..."
                      className="flex-1 h-9 text-sm"
                    />
                    <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-9 w-9 p-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                <div className="w-20 h-20 bg-weds-blue-100 rounded-full flex items-center justify-center">
                  <Phone className="h-10 w-10 text-weds-blue" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Vous êtes en communication avec un opérateur.<br />
                  Utilisez le chat ou l&apos;appel vocal.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => setShowChat(true)}>
                    <MessageCircle className="h-4 w-4" />
                    Chat
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={startAudioCall}>
                    <Phone className="h-4 w-4" />
                    Appel vocal
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      // ==================== ESCALATED ====================
      case 'escalated':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-amber-600">Escalade de l&apos;alerte</p>
            <p className="text-sm text-muted-foreground">Aucun opérateur n&apos;est disponible.</p>
            <div className="w-full space-y-2">
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1 justify-center">
                <WifiOff className="h-3 w-3" /> Appelez les secours directement :
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCY_NUMBERS.map((em) => (
                  <button
                    key={em.label}
                    onClick={() => handleEmergencyCall(em.number)}
                    className="flex items-center gap-2 p-2.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition cursor-pointer"
                  >
                    <span className="text-lg">{em.icon}</span>
                    <div className="text-left">
                      <p className="font-bold">{em.number}</p>
                      <p className="text-[9px] opacity-80">{em.label}</p>
                    </div>
                  </button>
                ))}
              </div>
              {/* SMS fallback */}
              {deviceData?.latitude && (
                <button
                  onClick={() => handleEmergencySms('112')}
                  className="w-full p-2 bg-amber-100 text-amber-800 rounded-lg text-xs hover:bg-amber-200 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Envoyer SMS avec position GPS
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={resetCaller}>
              Réessayer via l&apos;application
            </Button>
          </div>
        );

      // ==================== REJECTED ====================
      case 'rejected':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <PhoneMissed className="h-10 w-10 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-amber-600">Appel non répondu</p>
            <p className="text-sm text-muted-foreground">Aucun opérateur disponible.</p>
            <div className="w-full space-y-2">
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1 justify-center">
                <WifiOff className="h-3 w-3" /> Appelez les secours :
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCY_NUMBERS.map((em) => (
                  <button
                    key={em.label}
                    onClick={() => handleEmergencyCall(em.number)}
                    className="flex items-center gap-2 p-2.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition cursor-pointer"
                  >
                    <span>{em.icon}</span>
                    <div className="text-left">
                      <p className="font-bold">{em.number}</p>
                      <p className="text-[9px] opacity-80">{em.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={resetCaller}>
              Réessayer
            </Button>
          </div>
        );

      // ==================== TIMEOUT ====================
      case 'timeout':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-10 w-10 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-amber-600">Délai dépassé</p>
            <p className="text-sm text-muted-foreground">Aucun opérateur n&apos;a répondu.</p>
            <div className="w-full space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCY_NUMBERS.map((em) => (
                  <button
                    key={em.label}
                    onClick={() => handleEmergencyCall(em.number)}
                    className="flex items-center gap-2 p-2.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition cursor-pointer"
                  >
                    <span>{em.icon}</span>
                    <div className="text-left">
                      <p className="font-bold">{em.number}</p>
                      <p className="text-[9px] opacity-80">{em.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={resetCaller}>
              Réessayer
            </Button>
          </div>
        );

      // ==================== ENDED ====================
      case 'ended':
        return (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <PhoneOff className="h-10 w-10 text-gray-500" />
            </div>
            <p className="text-lg font-bold">Appel terminé</p>
            <p className="text-sm text-muted-foreground">La communication a été fermée.</p>
            <Button variant="outline" size="sm" onClick={resetCaller}>
              Nouvel appel
            </Button>
          </div>
        );

      // ==================== OFFLINE ====================
      case 'offline':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <WifiOff className="h-10 w-10 text-red-600" />
            </div>
            <p className="text-lg font-bold text-red-600">MODE HORS CONNEXION</p>
            <p className="text-sm text-muted-foreground">Aucune connexion Internet détectée</p>

            {offlineAlertStored && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                ✅ Alerte stockée localement - sera synchronisée automatiquement
              </div>
            )}

            {/* Auto-call countdown */}
            {!offlineAutoCall && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-red-700">
                  Appel automatique au 112 dans {offlineCountdown}s
                </p>
                <div className="w-full bg-red-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${((5 - offlineCountdown) / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Emergency call buttons */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {EMERGENCY_NUMBERS.map((em) => (
                <button
                  key={em.label}
                  onClick={() => handleEmergencyCall(em.number)}
                  className="flex items-center gap-2 p-3 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition cursor-pointer"
                >
                  <span className="text-lg">{em.icon}</span>
                  <div className="text-left">
                    <p className="font-bold">{em.number}</p>
                    <p className="text-[9px] opacity-80">{em.label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* SMS fallback */}
            {deviceData?.latitude && (
              <button
                onClick={() => handleEmergencySms('112')}
                className="w-full p-3 bg-amber-100 text-amber-800 rounded-lg text-xs hover:bg-amber-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                Envoyer SMS avec position GPS
              </button>
            )}

            <Button variant="outline" size="sm" onClick={resetCaller}>
              Annuler
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-red-600 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <Siren className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">SOS URGENCE</h2>
              <p className="text-red-100 text-xs">
                {callerStatus === 'idle' && 'Appel d\'urgence & géolocalisation'}
                {callerStatus === 'confirming' && 'Confirmation requise'}
                {callerStatus === 'calling' && 'Envoi en cours...'}
                {callerStatus === 'ringing' && 'Appel en cours...'}
                {callerStatus === 'connected' && 'Communication établie'}
                {callerStatus === 'escalated' && 'Escalade en cours'}
                {callerStatus === 'offline' && 'Mode hors connexion'}
                {callerStatus === 'rejected' && 'Appel non répondu'}
                {callerStatus === 'timeout' && 'Délai dépassé'}
                {callerStatus === 'ended' && 'Appel terminé'}
              </p>
            </div>
          </div>
          {callerStatus === 'idle' && (
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

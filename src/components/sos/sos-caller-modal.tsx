'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSosStore, SosChatMessage } from '@/store/sos-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  PhoneMissed,
  MapPin,
  MessageCircle,
  Send,
  WifiOff,
  Siren,
  ShieldCheck,
  X,
  Clock,
  Shield,
  User,
  Copy,
  CheckCircle2,
} from 'lucide-react';

// Togo emergency numbers (fallback for no-connection)
const EMERGENCY_NUMBERS = [
  { label: 'Urgences', number: '112', icon: '🚨' },
  { label: 'Police', number: '117', icon: '👮' },
  { label: 'SAMU', number: '118', icon: '🚑' },
  { label: 'Pompiers', number: '118', icon: '🚒' },
];

// ==================== CALLER STATUS DISPLAY ====================
function CallerStatusDisplay() {
  const { callerStatus, currentCall, endCall, messages, sendChatMessage, resetCaller } = useSosStore();
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), currentCall?.callerId || 'anonymous', currentCall?.callerName || 'Victime');
    setChatInput('');
  };

  const handleCopyAdminId = () => {
    if (currentCall?.acceptedBy?.id) {
      navigator.clipboard.writeText(currentCall.acceptedBy.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Renders based on caller status
  switch (callerStatus) {
    case 'calling':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <PhoneCall className="h-10 w-10 text-white" />
          </div>
          <p className="text-lg font-bold text-red-600">Envoi de l&apos;appel SOS...</p>
          <p className="text-sm text-muted-foreground">Veuillez patienter</p>
        </div>
      );

    case 'ringing':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center animate-pulse">
              <PhoneIncoming className="h-12 w-12 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
            <div className="absolute -inset-4 rounded-full border-2 border-red-300 animate-ping opacity-20" style={{ animationDelay: '0.5s' }} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-red-600">Appel en cours...</p>
            <p className="text-sm text-muted-foreground">En attente qu&apos;un administrateur réponde</p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Votre position GPS a été transmise</span>
            </div>
          </div>
          <Button
            variant="destructive"
            className="mt-4 gap-2"
            onClick={() => endCall('caller')}
          >
            <PhoneOff className="h-4 w-4" />
            Annuler l&apos;appel
          </Button>
        </div>
      );

    case 'connected':
      return (
        <div className="flex flex-col h-full min-h-[400px]">
          {/* Connected header with Admin ID */}
          <div className="bg-weds-blue text-white p-3 flex items-center justify-between rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold">Connecté à l&apos;admin</p>
                <p className="text-[10px] text-weds-blue-100">Communication établie</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 h-8 gap-1"
                onClick={() => setShowChat(!showChat)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-red-500/50 h-8 gap-1"
                onClick={() => endCall('caller')}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Admin Info Card */}
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
                      {currentCall.acceptedBy.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[10px] text-weds-blue font-mono truncate">
                      ID: {currentCall.acceptedBy.id}
                    </p>
                    <button
                      onClick={handleCopyAdminId}
                      className="text-weds-blue hover:text-weds-blue-700 transition shrink-0"
                      aria-label="Copier l'ID admin"
                    >
                      {copiedId ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat area */}
          {showChat && (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-3" style={{ maxHeight: '300px' }}>
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === (currentCall?.callerId || 'anonymous') ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                          msg.type === 'system'
                            ? 'bg-muted text-muted-foreground text-xs italic text-center'
                            : msg.senderId === (currentCall?.callerId || 'anonymous')
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

              {/* Chat input */}
              <div className="p-2 border-t">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Écrire un message..."
                    className="flex-1 h-9 text-sm"
                  />
                  <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 h-9 w-9 p-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}

          {!showChat && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="w-20 h-20 bg-weds-blue-100 rounded-full flex items-center justify-center">
                <Phone className="h-10 w-10 text-weds-blue" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Vous êtes en communication avec un administrateur.<br />
                Utilisez le chat pour communiquer.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowChat(true)}
              >
                <MessageCircle className="h-4 w-4" />
                Ouvrir le chat
              </Button>
            </div>
          )}
        </div>
      );

    case 'rejected':
      return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <PhoneMissed className="h-10 w-10 text-amber-600" />
          </div>
          <p className="text-lg font-bold text-amber-600">Appel non répondu</p>
          <p className="text-sm text-muted-foreground">Aucun administrateur n&apos;est disponible.</p>
          <div className="space-y-2 w-full max-w-xs">
            <p className="text-xs font-semibold text-red-600 flex items-center gap-1 justify-center">
              <WifiOff className="h-3 w-3" /> Appelez les secours directement :
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_NUMBERS.map((em) => (
                <a
                  key={em.label}
                  href={`tel:${em.number}`}
                  className="flex items-center gap-2 p-2 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition"
                >
                  <span>{em.icon}</span>
                  <div>
                    <p className="font-bold">{em.number}</p>
                    <p className="text-[9px] opacity-80">{em.label}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetCaller} className="mt-2">
            Réessayer via l&apos;application
          </Button>
        </div>
      );

    case 'timeout':
      return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
          <p className="text-lg font-bold text-amber-600">Délai dépassé</p>
          <p className="text-sm text-muted-foreground">Aucun admin n&apos;a répondu.</p>
          <div className="space-y-2 w-full max-w-xs">
            <p className="text-xs font-semibold text-red-600 flex items-center gap-1 justify-center">
              <WifiOff className="h-3 w-3" /> Appelez les secours directement :
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_NUMBERS.map((em) => (
                <a
                  key={em.label}
                  href={`tel:${em.number}`}
                  className="flex items-center gap-2 p-2 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition"
                >
                  <span>{em.icon}</span>
                  <div>
                    <p className="font-bold">{em.number}</p>
                    <p className="text-[9px] opacity-80">{em.label}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetCaller} className="mt-2">
            Réessayer via l&apos;application
          </Button>
        </div>
      );

    case 'ended':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <PhoneOff className="h-10 w-10 text-gray-500" />
          </div>
          <p className="text-lg font-bold">Appel terminé</p>
          <p className="text-sm text-muted-foreground">La communication a été fermée.</p>
        </div>
      );

    default:
      return null;
  }
}

// ==================== SOS CALL MODAL (VICTIM SIDE) ====================
export function SosCallerModal({ onClose }: { onClose: () => void }) {
  const { callerStatus, resetCaller, availableAdmins, fetchAdmins } = useSosStore();
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [step, setStep] = useState<'form' | 'active'>('form');

  // Get geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationError('');
        },
        () => {
          setLocationError('Position non disponible');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  // Fetch available admins on mount
  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleInitiateCall = () => {
    const { initiateCall, connect: connectSocket } = useSosStore.getState();

    // Connect socket if not connected
    if (!useSosStore.getState().isConnected) {
      connectSocket('anonymous', callerName || 'Victime anonyme', 'BENEFICIAIRE');
    }

    initiateCall({
      callerId: 'anonymous',
      callerName: callerName || 'Victime anonyme',
      callerPhone: callerPhone || undefined,
      latitude: location?.lat,
      longitude: location?.lng,
      urgencyLevel: 'critical',
    });

    setStep('active');
  };

  const handleClose = () => {
    resetCaller();
    onClose();
  };

  const primaryAdmin = availableAdmins[0];

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
              <p className="text-red-100 text-xs">Appel interne & géolocalisation</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'form' && callerStatus === 'idle' ? (
            <div className="p-4 space-y-4">
              {/* Admin Info Section */}
              {primaryAdmin && (
                <div className="bg-weds-blue-50 border border-weds-blue-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-weds-blue-700 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    Votre appel sera dirigé vers l&apos;administrateur :
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-weds-blue rounded-full flex items-center justify-center text-white shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-weds-blue-700">{primaryAdmin.name}</p>
                        <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0 text-[9px] px-1.5 py-0">
                          {primaryAdmin.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-weds-blue font-mono">
                          ID: {primaryAdmin.id}
                        </span>
                      </div>
                      {primaryAdmin.phone && (
                        <p className="text-[10px] text-weds-blue mt-0.5">
                          📞 {primaryAdmin.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  {availableAdmins.length > 1 && (
                    <p className="text-[10px] text-weds-blue">
                      + {availableAdmins.length - 1} autre(s) admin(s) disponible(s)
                    </p>
                  )}
                </div>
              )}

              {/* Location Status */}
              <div className={`rounded-lg p-3 flex items-center gap-2 ${location ? 'bg-weds-blue-50' : 'bg-amber-50'}`}>
                <MapPin className={`h-4 w-4 shrink-0 ${location ? 'text-weds-blue' : 'text-amber-600'}`} />
                <span className={`text-xs ${location ? 'text-weds-blue-700' : 'text-amber-700'}`}>
                  {location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : locationError || 'Localisation en cours...'}
                </span>
              </div>

              {/* Caller info */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Vos coordonnées (optionnel) :</p>
                <Input
                  placeholder="Votre nom"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="h-9 text-sm"
                  aria-label="Votre nom"
                />
                <Input
                  placeholder="Votre téléphone"
                  type="tel"
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value)}
                  className="h-9 text-sm"
                  aria-label="Votre téléphone"
                />
              </div>

              <Separator />

              {/* BIG SOS CALL BUTTON */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleInitiateCall}
                  className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-red-700 text-white shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300 cursor-pointer"
                  aria-label="Appeler les secours - SOS"
                >
                  <Phone className="h-10 w-10 mb-2" />
                  <span className="text-2xl font-black">SOS</span>
                  <span className="text-xs font-medium mt-1">APPELER</span>
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
                </button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Appuyez pour appeler un administrateur
                </p>
              </div>

              <Separator />

              {/* Fallback external calls */}
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Sans connexion ? Appelez directement :
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EMERGENCY_NUMBERS.map((em) => (
                    <a
                      key={em.label}
                      href={`tel:${em.number}`}
                      className="flex items-center gap-2 p-2 bg-amber-100 text-amber-800 rounded-lg text-xs hover:bg-amber-200 transition"
                    >
                      <span>{em.icon}</span>
                      <div>
                        <p className="font-bold">{em.number}</p>
                        <p className="text-[9px]">{em.label}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <CallerStatusDisplay />
          )}
        </div>
      </div>
    </div>
  );
}

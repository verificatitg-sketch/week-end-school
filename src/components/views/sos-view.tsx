'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useSosStore } from '@/store/sos-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Phone,
  Volume2,
  VolumeX,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  Shield,
  Radio,
  PhoneIncoming,
  PhoneOff,
  PhoneCall,
  PhoneMissed,
  MessageCircle,
  Send,
  WifiOff,
  ShieldCheck,
  XCircle,
  Copy,
} from 'lucide-react';

// Togo emergency numbers (fallback)
const EMERGENCY_NUMBERS_DATA = [
  { labelKey: 'sos.emergencies', number: '112', icon: '🚨' },
  { labelKey: 'sos.police', number: '117', icon: '👮' },
  { labelKey: 'sos.samu', number: '118', icon: '🚑' },
  { labelKey: 'sos.firefighters', number: '118', icon: '🚒' },
];

interface SOSAlert {
  id: string;
  urgency: string;
  status: string;
  createdAt: string;
  location?: string;
  intervention?: string;
}

// URGENCY_LABELS and STATUS_LABELS moved inside component for i18n

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-weds-blue-100 text-weds-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800',
};

export function SOSView() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const { t } = useTranslation();

  const URGENCY_LABELS: Record<string, string> = {
    low: t('alerts.low'),
    medium: t('alerts.medium'),
    high: t('alerts.high'),
    critical: t('alerts.critical'),
  };

  const STATUS_LABELS: Record<string, string> = {
    active: t('sos.statusActive'),
    investigating: t('sos.statusInvestigating'),
    resolved: t('sos.statusResolved'),
    received: t('sos.statusReceived'),
    in_progress: t('sos.statusInProgress'),
  };

  const EMERGENCY_NUMBERS = EMERGENCY_NUMBERS_DATA.map((em) => ({
    ...em,
    label: t(em.labelKey),
  }));
  const {
    callerStatus,
    currentCall,
    messages,
    initiateCall,
    endCall,
    sendChatMessage,
    resetCaller,
    connect: connectSocket,
    isConnected,
  } = useSosStore();

  const [sending, setSending] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [urgency, setUrgency] = useState('high');
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copiedAdminId, setCopiedAdminId] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleCopyAdminId = () => {
    if (currentCall?.acceptedBy?.id) {
      navigator.clipboard.writeText(currentCall.acceptedBy.id);
      setCopiedAdminId(true);
      setTimeout(() => setCopiedAdminId(false), 2000);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect socket on mount
  useEffect(() => {
    if (user && !isConnected) {
      connectSocket(user.id, user.name, (user.role as Record<string, string>)?.name || 'BENEFICIAIRE');
    }
  }, [user, isConnected, connectSocket]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/sos', { headers });
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || data || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [token]);

  const handleSOS = async () => {
    setSending(true);

    // Get geolocation
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      }).catch(() => null);
      if (position) {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
    } catch {
      // Continue without location
    }

    // Also save to DB
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ urgency, silent: silentMode, latitude, longitude }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts((prev) => [data.alert || data, ...prev]);
      }
    } catch {
      // Continue even if DB save fails
    }

    // Initiate real-time SOS call via socket
    initiateCall({
      callerId: user?.id,
      callerName: user?.name || t('sos.defaultUser'),
      callerPhone: user?.phone || undefined,
      latitude,
      longitude,
      urgencyLevel: urgency,
    });

    setSending(false);
  };

  const activeAlerts = alerts.filter((a) => a.status === 'active' || a.status === 'investigating' || a.status === 'received' || a.status === 'in_progress');

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), user?.id || 'anonymous', user?.name || t('sos.defaultVictim'));
    setChatInput('');
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-red-900 flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-red-600" />
          {t('sos.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('sos.subtitle')}
        </p>
      </div>

      {/* ==================== SOS CALL STATES ==================== */}

      {/* IDLE - Show SOS button */}
      {callerStatus === 'idle' && (
        <div className="flex flex-col items-center py-8">
          <button
            onClick={handleSOS}
            disabled={sending}
            className={`
              relative w-48 h-48 rounded-full flex flex-col items-center justify-center
              bg-gradient-to-br from-red-500 to-red-700 text-white
              shadow-2xl hover:shadow-red-500/50 transition-all duration-300
              hover:scale-105 active:scale-95
              focus:outline-none focus:ring-4 focus:ring-red-300
              ${sending ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-label={t('sos.sosAriaLabel')}
          >
            {sending ? (
              <Loader2 className="h-12 w-12 animate-spin mb-2" />
            ) : (
              <>
                <Phone className="h-10 w-10 mb-2" />
                <span className="text-2xl font-black">SOS</span>
                <span className="text-xs font-medium mt-1">{t('sos.button')}</span>
              </>
            )}
            {/* Pulsing ring */}
            {!sending && (
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
            )}
          </button>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            {t('sos.callAdmin')}
          </p>
        </div>
      )}

      {/* CALLING */}
      {callerStatus === 'calling' && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <PhoneCall className="h-10 w-10 text-white" />
          </div>
          <p className="text-lg font-bold text-red-600">{t('sos.calling')}</p>
        </div>
      )}

      {/* RINGING */}
      {callerStatus === 'ringing' && (
        <div className="flex flex-col items-center py-8 space-y-4">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center animate-pulse">
              <PhoneIncoming className="h-12 w-12 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-red-600">{t('sos.ringing')}</p>
            <p className="text-sm text-muted-foreground">{t('sos.ringingSubtitle')}</p>
          </div>
          <Button variant="destructive" className="gap-2" onClick={() => endCall(user?.id || 'caller')}>
            <PhoneOff className="h-4 w-4" />
            {t('common.cancel')}
          </Button>
        </div>
      )}

      {/* CONNECTED - Chat with admin */}
      {callerStatus === 'connected' && (
        <Card className="border-weds-blue-100">
          <CardHeader className="bg-weds-blue text-white rounded-t-lg pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <div>
                  <CardTitle className="text-sm">{t('sos.connected')}</CardTitle>
                  <CardDescription className="text-weds-blue-100 text-xs">{t('sos.connectedSubtitle')}</CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-red-500/50 h-8 gap-1"
                onClick={() => endCall(user?.id || 'caller')}
              >
                <PhoneOff className="h-4 w-4" />
                {t('sos.endCall')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Admin info with ID */}
            {currentCall?.acceptedBy && (
              <div className="p-3 bg-weds-blue-50 border-b border-weds-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-weds-blue rounded-full flex items-center justify-center text-white shrink-0">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-weds-blue-700">{currentCall.acceptedBy.name}</p>
                      <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0 text-[9px] px-1.5 py-0">
                        {currentCall.acceptedBy.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-weds-blue font-mono">ID: {currentCall.acceptedBy.id}</span>
                      <button
                        onClick={handleCopyAdminId}
                        className="text-weds-blue hover:text-weds-blue-700 transition"
                        aria-label={t('sos.copyAdminId')}
                      >
                        {copiedAdminId ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Chat messages */}
            <div className="max-h-64 overflow-y-auto p-3 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === (user?.id || 'anonymous') ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.type === 'system'
                        ? 'bg-muted text-muted-foreground text-xs italic'
                        : msg.senderId === (user?.id || 'anonymous')
                          ? 'bg-red-600 text-white rounded-br-sm'
                          : 'bg-weds-blue-100 text-weds-blue-700 rounded-bl-sm'
                    }`}
                  >
                    {msg.type !== 'system' && (
                      <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.senderName}</p>
                    )}
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Chat input */}
            <div className="p-3 border-t">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendChat(); }}
                className="flex gap-2"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t('sos.chatPlaceholder')}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" className="bg-weds-blue hover:bg-weds-blue-700 h-9 w-9 p-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REJECTED / TIMEOUT */}
      {(callerStatus === 'rejected' || callerStatus === 'timeout') && (
        <Card className="border-amber-200">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <PhoneMissed className="h-10 w-10 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-amber-600">
              {callerStatus === 'timeout' ? t('sos.timeout') : t('sos.rejected')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('sos.rejectedSubtitleFull')}
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
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
            <Button variant="outline" onClick={resetCaller} className="mt-2">
              {t('sos.retryApp')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ENDED */}
      {callerStatus === 'ended' && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <PhoneOff className="h-10 w-10 text-gray-400 mx-auto" />
            <p className="text-lg font-bold">{t('sos.ended')}</p>
            <Button variant="outline" onClick={resetCaller}>
              {t('sos.newCall')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SOS Options - only when idle */}
      {callerStatus === 'idle' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
              <Switch
                checked={silentMode}
                onCheckedChange={setSilentMode}
                aria-label={t('sos.silentMode')}
              />
              <Label className="flex items-center gap-2 cursor-pointer">
                {silentMode ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
                {t('sos.silentMode')}
              </Label>
            </div>

            <div className="p-4 bg-white rounded-xl border">
              <Label className="text-sm mb-2 block">{t('sos.urgencyLevel')}</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="w-full" aria-label={t('sos.urgencyLevel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('alerts.low')}</SelectItem>
                  <SelectItem value="medium">{t('alerts.medium')}</SelectItem>
                  <SelectItem value="high">{t('alerts.high')}</SelectItem>
                  <SelectItem value="critical">{t('alerts.critical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fallback external calls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <WifiOff className="h-5 w-5 text-amber-600" />
                {t('sos.noConnectionTitle')}
              </CardTitle>
              <CardDescription>{t('sos.emergencyNumbers')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EMERGENCY_NUMBERS.map((em) => (
                  <a
                    key={em.label}
                    href={`tel:${em.number}`}
                    className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-lg text-xs hover:bg-amber-200 transition"
                  >
                    <span className="text-lg">{em.icon}</span>
                    <div>
                      <p className="font-bold">{em.number}</p>
                      <p className="text-[9px]">{em.label}</p>
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Active Alerts Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-600" />
            {t('sos.activeAlerts')} ({activeAlerts.length})
          </CardTitle>
          <CardDescription>{t('sos.activeAlertsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-weds-blue-600 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {t('sos.noActiveAlerts')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 p-3 bg-weds-red-50 rounded-lg border border-red-100"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      alert.status === 'active' || alert.status === 'received' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`${URGENCY_COLORS[alert.urgency]} border-0 text-xs`}>
                        {URGENCY_LABELS[alert.urgency]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[alert.status] || alert.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.createdAt).toLocaleString('fr-FR')}
                      </span>
                      {alert.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intervention Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-weds-blue" />
            {t('sos.interventionTracking')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.filter((a) => a.intervention).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('sos.noInterventions')}
            </p>
          ) : (
            <div className="space-y-3">
              {alerts
                .filter((a) => a.intervention)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 p-3 bg-weds-blue-50 rounded-lg"
                  >
                    <CheckCircle2 className="h-5 w-5 text-weds-blue shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{alert.intervention}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

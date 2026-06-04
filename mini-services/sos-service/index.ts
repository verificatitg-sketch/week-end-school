import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ==================== TYPES ====================
interface SosCall {
  id: string
  callerId: string
  callerName: string
  callerPhone?: string
  latitude?: number
  longitude?: number
  address?: string
  urgencyLevel: string
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'timeout' | 'escalated'
  escalationLevel: number // 0=normal, 1=escalated, 2=external
  batteryLevel?: number
  networkStatus?: string
  isAnonymous: boolean
  sessionId?: string
  assignedAdminId?: string
  fallbackAdminId?: string
  autoTriggered: boolean
  createdAt: Date
  acceptedAt?: Date
}

interface GpsPosition {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  timestamp: Date
}

interface CallLogEntry {
  id: string
  callId: string
  action: string
  actorId?: string
  details?: string
  timestamp: Date
}

interface ChatMessage {
  id: string
  callId: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  type: 'user' | 'system'
}

interface UserInfo {
  socketId: string
  userId: string
  userName: string
  role: string
  isAvailable: boolean // for operators
  lastSosTime?: number // for cooldown
  currentCallId?: string
}

// ==================== STATE ====================
const activeCalls = new Map<string, SosCall>()
const callMessages = new Map<string, ChatMessage[]>()
const callRooms = new Map<string, Set<string>>() // callId -> set of socketIds
const callGpsHistory = new Map<string, GpsPosition[]>() // callId -> GPS positions
const callLogs = new Map<string, CallLogEntry[]>() // callId -> log entries
const userSockets = new Map<string, UserInfo>() // socketId -> UserInfo
const userByUserId = new Map<string, string>() // userId -> socketId (for quick lookup)
const disconnectGraceTimers = new Map<string, NodeJS.Timeout>() // callId -> timer
const escalationTimers = new Map<string, NodeJS.Timeout>() // callId -> timer
const gpsHeartbeatIntervals = new Map<string, NodeJS.Timeout>() // callId -> interval

const generateId = () => Math.random().toString(36).substr(2, 12)

// ==================== HELPER FUNCTIONS ====================

function isAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'INTERVENANT_URGENCE'
}

function getOnlineAdmins(): UserInfo[] {
  const admins: UserInfo[] = []
  for (const user of userSockets.values()) {
    if (isAdminRole(user.role) && user.isAvailable) {
      admins.push(user)
    }
  }
  return admins
}

function getAllOnlineAdmins(): UserInfo[] {
  const admins: UserInfo[] = []
  for (const user of userSockets.values()) {
    if (isAdminRole(user.role)) {
      admins.push(user)
    }
  }
  return admins
}

function addCallLog(callId: string, action: string, actorId?: string, details?: string): void {
  const entry: CallLogEntry = {
    id: generateId(),
    callId,
    action,
    actorId,
    details,
    timestamp: new Date(),
  }
  if (!callLogs.has(callId)) {
    callLogs.set(callId, [])
  }
  callLogs.get(callId)!.push(entry)
}

function clearEscalationTimer(callId: string): void {
  const timer = escalationTimers.get(callId)
  if (timer) {
    clearTimeout(timer)
    escalationTimers.delete(callId)
  }
}

function startGpsHeartbeat(callId: string, callerSocketId: string): void {
  // Clear any existing heartbeat for this call
  stopGpsHeartbeat(callId)

  const interval = setInterval(() => {
    const call = activeCalls.get(callId)
    if (!call || call.status !== 'accepted') {
      stopGpsHeartbeat(callId)
      return
    }
    io.to(callerSocketId).emit('sos:request-gps', { callId })
  }, 7000)

  gpsHeartbeatIntervals.set(callId, interval)
}

function stopGpsHeartbeat(callId: string): void {
  const interval = gpsHeartbeatIntervals.get(callId)
  if (interval) {
    clearInterval(interval)
    gpsHeartbeatIntervals.delete(callId)
  }
}

function cleanupCall(callId: string): void {
  clearEscalationTimer(callId)
  stopGpsHeartbeat(callId)
  const graceTimer = disconnectGraceTimers.get(callId)
  if (graceTimer) {
    clearTimeout(graceTimer)
    disconnectGraceTimers.delete(callId)
  }
}

function assignOperator(callId: string): void {
  const call = activeCalls.get(callId)
  if (!call || call.status !== 'ringing') return

  const availableAdmins = getOnlineAdmins()

  if (availableAdmins.length === 0) {
    // No operator available - mark for escalation
    call.escalationLevel = 2
    call.status = 'escalated'
    addCallLog(callId, 'escalation', undefined, 'No available operator - external escalation (level 2)')

    io.to(`call:${callId}`).emit('sos:escalation', {
      callId,
      escalationLevel: 2,
      reason: 'No operator available',
      call,
    })

    // Also notify all admins (even unavailable ones) about the escalation
    for (const admin of getAllOnlineAdmins()) {
      io.to(admin.socketId).emit('sos:incoming-call', call)
      io.to(admin.socketId).emit('sos:escalation', {
        callId,
        escalationLevel: 2,
        reason: 'No available operator',
        call,
      })
    }

    console.log(`[SOS-Service] Call ${callId} escalated to level 2 - no operator available`)
    return
  }

  // Assign the first available admin as primary
  const primary = availableAdmins[0]
  call.assignedAdminId = primary.userId
  addCallLog(callId, 'operator_assigned', primary.userId, `Primary operator: ${primary.userName}`)

  // Notify the primary operator
  io.to(primary.socketId).emit('sos:incoming-call', call)

  // Notify the caller that an operator is being notified
  io.to(`call:${callId}`).emit('sos:operator-assigned', {
    callId,
    operatorName: primary.userName,
    operatorId: primary.userId,
  })

  console.log(`[SOS-Service] Call ${callId} assigned to primary operator: ${primary.userName} (${primary.userId})`)

  // Set 30-second escalation timer for primary
  const primaryTimeout = setTimeout(() => {
    const currentCall = activeCalls.get(callId)
    if (!currentCall || currentCall.status !== 'ringing') return

    console.log(`[SOS-Service] Primary operator ${primary.userName} did not respond in 30s for call ${callId}`)
    addCallLog(callId, 'timeout', primary.userId, `Primary operator ${primary.userName} did not respond`)

    // Try to find a fallback operator
    const fallbackAdmins = getOnlineAdmins().filter(a => a.userId !== primary.userId)

    if (fallbackAdmins.length > 0) {
      const fallback = fallbackAdmins[0]
      currentCall.fallbackAdminId = fallback.userId
      currentCall.escalationLevel = 1
      currentCall.status = 'escalated'
      addCallLog(callId, 'escalation', fallback.userId, `Fallback operator: ${fallback.userName} (level 1)`)

      // Notify fallback
      io.to(fallback.socketId).emit('sos:incoming-call', currentCall)

      // Notify caller
      io.to(`call:${callId}`).emit('sos:escalation', {
        callId,
        escalationLevel: 1,
        reason: 'Primary operator did not respond, assigning fallback',
        call: currentCall,
      })

      console.log(`[SOS-Service] Call ${callId} escalated to fallback: ${fallback.userName}`)

      // Set another 30-second timer for fallback
      const fallbackTimeout = setTimeout(() => {
        const nowCall = activeCalls.get(callId)
        // If call still exists and hasn't been accepted (still ringing or escalated), escalate to level 2
        if (nowCall && (nowCall.status === 'ringing' || nowCall.status === 'escalated')) {
          nowCall.escalationLevel = 2
          nowCall.status = 'escalated'
          addCallLog(callId, 'escalation', undefined, 'Fallback operator also did not respond - external escalation (level 2)')

          io.to(`call:${callId}`).emit('sos:escalation', {
            callId,
            escalationLevel: 2,
            reason: 'All operators unavailable - external escalation',
            call: nowCall,
          })

          // Notify all admins
          for (const admin of getAllOnlineAdmins()) {
            io.to(admin.socketId).emit('sos:escalation', {
              callId,
              escalationLevel: 2,
              reason: 'All operators unavailable - external escalation',
              call: nowCall,
            })
          }

          console.log(`[SOS-Service] Call ${callId} escalated to level 2 - fallback also did not respond`)
        }
      }, 30000)

      escalationTimers.set(callId, fallbackTimeout)
    } else {
      // No fallback available - escalate to level 2
      currentCall.escalationLevel = 2
      currentCall.status = 'escalated'
      addCallLog(callId, 'escalation', undefined, 'No fallback operator available - external escalation (level 2)')

      io.to(`call:${callId}`).emit('sos:escalation', {
        callId,
        escalationLevel: 2,
        reason: 'No fallback operator available',
        call: currentCall,
      })

      // Notify all admins
      for (const admin of getAllOnlineAdmins()) {
        io.to(admin.socketId).emit('sos:escalation', {
          callId,
          escalationLevel: 2,
          reason: 'No fallback operator available',
          call: currentCall,
        })
      }

      console.log(`[SOS-Service] Call ${callId} escalated to level 2 - no fallback available`)
    }
  }, 30000)

  escalationTimers.set(callId, primaryTimeout)
}

// ==================== SOCKET HANDLERS ====================
io.on('connection', (socket) => {
  console.log(`[SOS-Service] Connected: ${socket.id}`)

  // ==================== REGISTER ====================
  socket.on(
    'sos:register',
    (data: { userId: string; userName: string; role: string; isAvailable?: boolean }) => {
      const userInfo: UserInfo = {
        socketId: socket.id,
        userId: data.userId,
        userName: data.userName,
        role: data.role,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
        lastSosTime: undefined,
        currentCallId: undefined,
      }

      userSockets.set(socket.id, userInfo)
      userByUserId.set(data.userId, socket.id)

      console.log(`[SOS-Service] Registered: ${data.userName} (${data.role}) available=${userInfo.isAvailable}`)

      // If admin, send current active calls
      if (isAdminRole(data.role)) {
        const activeCallsList = Array.from(activeCalls.values()).filter(
          (c) => c.status === 'ringing' || c.status === 'accepted' || c.status === 'escalated'
        )
        socket.emit('sos:active-calls', activeCallsList)
      }
    }
  )

  // ==================== SET AVAILABILITY ====================
  socket.on('sos:set-availability', (data: { isAvailable: boolean }) => {
    const user = userSockets.get(socket.id)
    if (!user) return

    user.isAvailable = data.isAvailable
    console.log(`[SOS-Service] ${user.userName} availability set to: ${data.isAvailable}`)

    // If becoming available and there are escalated calls, notify
    if (data.isAvailable && isAdminRole(user.role)) {
      const escalatedCalls = Array.from(activeCalls.values()).filter(
        (c) => c.status === 'escalated' || c.status === 'ringing'
      )
      if (escalatedCalls.length > 0) {
        socket.emit('sos:active-calls', escalatedCalls)
      }
    }
  })

  // ==================== INITIATE SOS CALL ====================
  socket.on(
    'sos:call',
    (data: {
      callerId?: string
      callerName: string
      callerPhone?: string
      latitude?: number
      longitude?: number
      address?: string
      urgencyLevel?: string
      batteryLevel?: number
      networkStatus?: string
      isAnonymous?: boolean
      sessionId?: string
      autoTriggered?: boolean
    }) => {
      const callerId = data.callerId || 'anonymous'

      // Cooldown & Abuse Prevention
      const existingUser = userSockets.get(socket.id)
      if (existingUser && existingUser.lastSosTime) {
        const elapsed = Date.now() - existingUser.lastSosTime
        if (elapsed < 30000) {
          const remaining = Math.ceil((30000 - elapsed) / 1000)
          socket.emit('sos:cooldown-active', {
            remainingSeconds: remaining,
            message: `Veuillez attendre ${remaining} secondes avant de lancer un nouvel appel SOS.`,
          })
          console.log(`[SOS-Service] Cooldown active for ${existingUser.userName}: ${remaining}s remaining`)
          return
        }
      }

      // Update last SOS time
      if (existingUser) {
        existingUser.lastSosTime = Date.now()
      }

      const callId = generateId()
      const call: SosCall = {
        id: callId,
        callerId,
        callerName: data.isAnonymous ? 'Victime anonyme' : (data.callerName || 'Victime anonyme'),
        callerPhone: data.callerPhone,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        urgencyLevel: data.urgencyLevel || 'critical',
        status: 'ringing',
        escalationLevel: 0,
        batteryLevel: data.batteryLevel,
        networkStatus: data.networkStatus,
        isAnonymous: data.isAnonymous || false,
        sessionId: data.sessionId,
        assignedAdminId: undefined,
        fallbackAdminId: undefined,
        autoTriggered: data.autoTriggered || false,
        createdAt: new Date(),
      }

      activeCalls.set(callId, call)
      callMessages.set(callId, [])
      callRooms.set(callId, new Set([socket.id]))
      callGpsHistory.set(callId, [])
      callLogs.set(callId, [])

      // Join the call room
      socket.join(`call:${callId}`)

      // Track current call for user
      if (existingUser) {
        existingUser.currentCallId = callId
      }

      // Log the call start
      addCallLog(callId, 'call_started', callerId, `SOS call from ${call.callerName}, urgency: ${call.urgencyLevel}`)

      // Store initial GPS position if provided
      if (data.latitude !== undefined && data.longitude !== undefined) {
        const gpsPos: GpsPosition = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date(),
        }
        callGpsHistory.get(callId)!.push(gpsPos)
        addCallLog(callId, 'gps_update', callerId, `Initial GPS: ${data.latitude}, ${data.longitude}`)
      }

      // Confirm to caller
      socket.emit('sos:call-started', { callId, call })

      console.log(`[SOS-Service] SOS Call: ${callId} from ${call.callerName} (urgency: ${call.urgencyLevel})`)

      // Assign operator (NOT broadcast to all)
      assignOperator(callId)

      // Global timeout: auto-reject after 120 seconds if no answer at all
      setTimeout(() => {
        const currentCall = activeCalls.get(callId)
        if (currentCall && (currentCall.status === 'ringing' || currentCall.status === 'escalated')) {
          currentCall.status = 'timeout'
          addCallLog(callId, 'timeout', undefined, 'Call timed out after 120 seconds with no response')

          io.to(`call:${callId}`).emit('sos:call-timeout', { callId, call: currentCall })

          // Notify all admins
          for (const admin of getAllOnlineAdmins()) {
            io.to(admin.socketId).emit('sos:call-timed-out', { callId, call: currentCall })
          }

          cleanupCall(callId)
          activeCalls.delete(callId)
          console.log(`[SOS-Service] Call timeout after 120s: ${callId}`)
        }
      }, 120000)
    }
  )

  // ==================== ACCEPT CALL ====================
  socket.on('sos:accept-call', (data: { callId: string; adminId: string; adminName: string }) => {
    const call = activeCalls.get(data.callId)
    if (!call || (call.status !== 'ringing' && call.status !== 'escalated')) {
      socket.emit('sos:accept-failed', { callId: data.callId, reason: 'Call not found or already handled' })
      return
    }

    call.status = 'accepted'
    call.acceptedAt = new Date()

    // Clear escalation timer
    clearEscalationTimer(data.callId)

    // Mark the admin as unavailable (busy with this call)
    const adminUser = userSockets.get(socket.id)
    if (adminUser) {
      adminUser.isAvailable = false
      adminUser.currentCallId = data.callId
    }

    socket.join(`call:${data.callId}`)

    if (callRooms.has(data.callId)) {
      callRooms.get(data.callId)!.add(socket.id)
    }

    // Add system message
    const sysMsg: ChatMessage = {
      id: generateId(),
      callId: data.callId,
      senderId: 'system',
      senderName: 'Système',
      content: `${data.adminName} a accepté l'appel SOS`,
      timestamp: new Date(),
      type: 'system',
    }
    callMessages.get(data.callId)?.push(sysMsg)

    // Log
    addCallLog(data.callId, 'accepted', data.adminId, `Accepted by ${data.adminName}`)

    // Notify both parties
    io.to(`call:${data.callId}`).emit('sos:call-accepted', {
      callId: data.callId,
      adminName: data.adminName,
      adminId: data.adminId,
      call,
      systemMessage: sysMsg,
    })

    // Notify other admins that call was taken
    for (const admin of getAllOnlineAdmins()) {
      if (admin.socketId !== socket.id) {
        io.to(admin.socketId).emit('sos:call-taken', { callId: data.callId, adminName: data.adminName })
      }
    }

    // Start GPS heartbeat now that the call is accepted
    // Find the caller's socket in the call room
    const roomSockets = callRooms.get(data.callId)
    if (roomSockets) {
      for (const sockId of roomSockets) {
        const roomUser = userSockets.get(sockId)
        if (roomUser && !isAdminRole(roomUser.role)) {
          startGpsHeartbeat(data.callId, sockId)
          break
        }
      }
    }

    console.log(`[SOS-Service] Call accepted: ${data.callId} by ${data.adminName}`)
  })

  // ==================== REJECT CALL ====================
  socket.on('sos:reject-call', (data: { callId: string; adminId: string; adminName: string; reason?: string }) => {
    const call = activeCalls.get(data.callId)
    if (!call) return

    addCallLog(data.callId, 'rejected', data.adminId, `Rejected by ${data.adminName}${data.reason ? `: ${data.reason}` : ''}`)

    // If this was the assigned/fallback operator, try to reassign
    const wasAssigned =
      call.assignedAdminId === data.adminId || call.fallbackAdminId === data.adminId

    if (wasAssigned && call.status === 'ringing') {
      // Try reassigning to another available operator
      const otherAdmins = getOnlineAdmins().filter((a) => a.userId !== data.adminId)

      if (otherAdmins.length > 0) {
        // Reassign
        const nextAdmin = otherAdmins[0]
        call.assignedAdminId = nextAdmin.userId
        addCallLog(data.callId, 'operator_assigned', nextAdmin.userId, `Reassigned to: ${nextAdmin.userName}`)

        io.to(nextAdmin.socketId).emit('sos:incoming-call', call)
        io.to(`call:${data.callId}`).emit('sos:operator-assigned', {
          callId: data.callId,
          operatorName: nextAdmin.userName,
          operatorId: nextAdmin.userId,
        })

        console.log(`[SOS-Service] Call ${data.callId} reassigned to ${nextAdmin.userName} after rejection`)
        return
      }
    }

    // No more operators to try - reject the call
    call.status = 'rejected'

    // Notify caller
    io.to(`call:${data.callId}`).emit('sos:call-rejected', {
      callId: data.callId,
      adminName: data.adminName,
    })

    // Notify other admins
    for (const admin of getAllOnlineAdmins()) {
      io.to(admin.socketId).emit('sos:call-rejected-admin', { callId: data.callId })
    }

    cleanupCall(data.callId)
    activeCalls.delete(data.callId)
    console.log(`[SOS-Service] Call rejected: ${data.callId} by ${data.adminName}`)
  })

  // ==================== CHAT MESSAGE ====================
  socket.on(
    'sos:chat-message',
    (data: { callId: string; senderId: string; senderName: string; content: string }) => {
      const call = activeCalls.get(data.callId)
      if (!call) return

      const msg: ChatMessage = {
        id: generateId(),
        callId: data.callId,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: new Date(),
        type: 'user',
      }

      callMessages.get(data.callId)?.push(msg)
      io.to(`call:${data.callId}`).emit('sos:chat-message', msg)
    }
  )

  // ==================== END CALL ====================
  socket.on('sos:end-call', (data: { callId: string; endedBy: string }) => {
    const call = activeCalls.get(data.callId)
    if (!call) return

    call.status = 'ended'

    addCallLog(data.callId, 'ended', data.endedBy, `Call ended by ${data.endedBy}`)

    const sysMsg: ChatMessage = {
      id: generateId(),
      callId: data.callId,
      senderId: 'system',
      senderName: 'Système',
      content: `Appel terminé`,
      timestamp: new Date(),
      type: 'system',
    }

    io.to(`call:${data.callId}`).emit('sos:call-ended', {
      callId: data.callId,
      endedBy: data.endedBy,
      systemMessage: sysMsg,
    })

    // Mark the operator as available again
    for (const user of userSockets.values()) {
      if (user.currentCallId === data.callId) {
        user.isAvailable = true
        user.currentCallId = undefined
      }
    }

    cleanupCall(data.callId)
    activeCalls.delete(data.callId)
    console.log(`[SOS-Service] Call ended: ${data.callId}`)
  })

  // ==================== GET CALL MESSAGES ====================
  socket.on('sos:get-messages', (data: { callId: string }) => {
    const messages = callMessages.get(data.callId) || []
    socket.emit('sos:messages-history', { callId: data.callId, messages })
  })

  // ==================== GPS UPDATE ====================
  socket.on(
    'sos:gps-update',
    (data: { callId: string; latitude: number; longitude: number; accuracy?: number; speed?: number }) => {
      const call = activeCalls.get(data.callId)
      if (!call) return

      const gpsPos: GpsPosition = {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        speed: data.speed,
        timestamp: new Date(),
      }

      // Update call's current position
      call.latitude = data.latitude
      call.longitude = data.longitude

      // Store in GPS history
      callGpsHistory.get(data.callId)?.push(gpsPos)

      // Log the GPS update
      const user = userSockets.get(socket.id)
      addCallLog(
        data.callId,
        'gps_update',
        user?.userId,
        `GPS: ${data.latitude}, ${data.longitude} (accuracy: ${data.accuracy || 'N/A'})`
      )

      // Relay GPS update to the assigned operator
      if (call.assignedAdminId) {
        const adminSocketId = userByUserId.get(call.assignedAdminId)
        if (adminSocketId) {
          io.to(adminSocketId).emit('sos:gps-update', {
            callId: data.callId,
            position: gpsPos,
            call,
          })
        }
      }

      // Also emit to the call room for any other listeners
      socket.to(`call:${data.callId}`).emit('sos:gps-update', {
        callId: data.callId,
        position: gpsPos,
        call,
      })
    }
  )

  // ==================== WEBRTC SIGNALING ====================
  socket.on(
    'sos:webrtc-offer',
    (data: { callId: string; offer: unknown; callerId: string }) => {
      const call = activeCalls.get(data.callId)
      if (!call) return

      addCallLog(data.callId, 'webrtc_offer', data.callerId, 'WebRTC offer sent')

      // Relay offer to the assigned operator
      if (call.assignedAdminId) {
        const adminSocketId = userByUserId.get(call.assignedAdminId)
        if (adminSocketId) {
          io.to(adminSocketId).emit('sos:webrtc-offer', {
            callId: data.callId,
            offer: data.offer,
            callerId: data.callerId,
          })
        }
      }

      // Also relay to the call room
      socket.to(`call:${data.callId}`).emit('sos:webrtc-offer', {
        callId: data.callId,
        offer: data.offer,
        callerId: data.callerId,
      })
    }
  )

  socket.on(
    'sos:webrtc-answer',
    (data: { callId: string; answer: unknown; adminId: string }) => {
      const call = activeCalls.get(data.callId)
      if (!call) return

      addCallLog(data.callId, 'webrtc_answer', data.adminId, 'WebRTC answer sent')

      // Relay answer to the caller (and others in the room)
      socket.to(`call:${data.callId}`).emit('sos:webrtc-answer', {
        callId: data.callId,
        answer: data.answer,
        adminId: data.adminId,
      })
    }
  )

  socket.on(
    'sos:webrtc-ice-candidate',
    (data: { callId: string; candidate: unknown; senderId: string }) => {
      const call = activeCalls.get(data.callId)
      if (!call) return

      // Relay ICE candidate to the other party
      socket.to(`call:${data.callId}`).emit('sos:webrtc-ice-candidate', {
        callId: data.callId,
        candidate: data.candidate,
        senderId: data.senderId,
      })
    }
  )

  // ==================== CALL LOGS ====================
  socket.on('sos:call-logs', (data: { callId: string }) => {
    const logs = callLogs.get(data.callId) || []
    socket.emit('sos:call-logs', { callId: data.callId, logs })
  })

  // ==================== GET GPS HISTORY ====================
  socket.on('sos:gps-history', (data: { callId: string }) => {
    const history = callGpsHistory.get(data.callId) || []
    socket.emit('sos:gps-history', { callId: data.callId, positions: history })
  })

  // ==================== DISCONNECT ====================
  socket.on('disconnect', (reason) => {
    const user = userSockets.get(socket.id)
    if (!user) {
      console.log(`[SOS-Service] Disconnected unregistered socket: ${socket.id} (reason: ${reason})`)
      return
    }

    console.log(`[SOS-Service] Disconnected: ${user.userName} (${user.role}) (reason: ${reason})`)

    // Clean up user maps
    userSockets.delete(socket.id)
    userByUserId.delete(user.userId)

    // If the user is in an active call, handle it
    if (user.currentCallId) {
      const call = activeCalls.get(user.currentCallId)
      if (!call) {
        user.currentCallId = undefined
        return
      }

      if (!isAdminRole(user.role)) {
        // Caller disconnected during active call
        if (call.status === 'accepted' || call.status === 'ringing') {
          addCallLog(
            call.id,
            'caller_disconnected',
            user.userId,
            `Caller ${user.userName} disconnected unexpectedly`
          )

          // Notify the assigned operator
          if (call.assignedAdminId) {
            const adminSocketId = userByUserId.get(call.assignedAdminId)
            if (adminSocketId) {
              io.to(adminSocketId).emit('sos:caller-disconnected', {
                callId: call.id,
                callerName: user.userName,
                gracePeriodSeconds: 30,
              })
            }
          }

          console.log(`[SOS-Service] Caller ${user.userName} disconnected during call ${call.id} - 30s grace period`)

          // 30-second grace period before marking the call as ended
          const graceTimer = setTimeout(() => {
            const currentCall = activeCalls.get(call.id)
            if (currentCall && (currentCall.status === 'accepted' || currentCall.status === 'ringing')) {
              currentCall.status = 'ended'
              addCallLog(call.id, 'ended', undefined, 'Call ended - caller did not reconnect within grace period')

              io.to(`call:${call.id}`).emit('sos:call-ended', {
                callId: call.id,
                endedBy: 'system',
                reason: 'Caller did not reconnect',
              })

              // Mark the operator as available again
              for (const u of userSockets.values()) {
                if (u.currentCallId === call.id) {
                  u.isAvailable = true
                  u.currentCallId = undefined
                }
              }

              cleanupCall(call.id)
              activeCalls.delete(call.id)
              console.log(`[SOS-Service] Call ${call.id} ended - caller did not reconnect`)
            }
          }, 30000)

          disconnectGraceTimers.set(call.id, graceTimer)
        }
      } else {
        // Operator disconnected during active call
        if (call.status === 'accepted' && call.assignedAdminId === user.userId) {
          addCallLog(
            call.id,
            'operator_disconnected',
            user.userId,
            `Operator ${user.userName} disconnected during active call`
          )

          // Notify the caller
          io.to(`call:${call.id}`).emit('sos:operator-disconnected', {
            callId: call.id,
            operatorName: user.userName,
          })

          // Try to reassign to another available operator
          const otherAdmins = getOnlineAdmins()
          if (otherAdmins.length > 0) {
            const newOp = otherAdmins[0]
            call.assignedAdminId = newOp.userId
            addCallLog(call.id, 'operator_assigned', newOp.userId, `Reassigned after disconnect: ${newOp.userName}`)

            // Add the new operator to the call room
            io.to(newOp.socketId).emit('sos:incoming-call', call)
            io.to(`call:${call.id}`).emit('sos:operator-assigned', {
              callId: call.id,
              operatorName: newOp.userName,
              operatorId: newOp.userId,
            })

            console.log(`[SOS-Service] Call ${call.id} reassigned to ${newOp.userName} after operator disconnect`)
          } else {
            // No other operator available - escalate
            call.escalationLevel = 2
            call.status = 'escalated'
            addCallLog(call.id, 'escalation', undefined, 'Operator disconnected and no replacement - level 2')

            io.to(`call:${call.id}`).emit('sos:escalation', {
              callId: call.id,
              escalationLevel: 2,
              reason: 'Operator disconnected and no replacement available',
              call,
            })

            console.log(`[SOS-Service] Call ${call.id} escalated - operator disconnected, no replacement`)
          }
        }
      }

      user.currentCallId = undefined
    }
  })

  // ==================== ERROR ====================
  socket.on('error', (error) => {
    console.error(`[SOS-Service] Socket error (${socket.id}):`, error)
  })
})

// ==================== START SERVER ====================
const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[SOS-Service] SOS WebSocket server running on port ${PORT}`)
})

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('[SOS-Service] Shutting down...')

  // Clean up all timers
  for (const timer of escalationTimers.values()) clearTimeout(timer)
  for (const interval of gpsHeartbeatIntervals.values()) clearInterval(interval)
  for (const timer of disconnectGraceTimers.values()) clearTimeout(timer)

  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[SOS-Service] Shutting down...')

  // Clean up all timers
  for (const timer of escalationTimers.values()) clearTimeout(timer)
  for (const interval of gpsHeartbeatIntervals.values()) clearInterval(interval)
  for (const timer of disconnectGraceTimers.values()) clearTimeout(timer)

  httpServer.close(() => process.exit(0))
})

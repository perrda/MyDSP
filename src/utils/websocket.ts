// WebSocket client library with auto-reconnect, subscriptions, and message queuing

export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  reconnect?: boolean
  reconnectInterval?: number
  reconnectDecay?: number
  reconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatMessage?: string
  messageQueueSize?: number
  debug?: boolean
}

export interface WebSocketConfigInternal {
  url: string
  protocols: string | string[] | undefined
  reconnect: boolean
  reconnectInterval: number
  reconnectDecay: number
  reconnectAttempts: number
  heartbeatInterval: number
  heartbeatMessage: string
  messageQueueSize: number
  debug: boolean
}

export interface WebSocketMessage<T = any> {
  id?: string
  type: string
  payload?: T
  timestamp?: number
}

export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'reconnect' | 'heartbeat'
export type WebSocketListener<T = any> = (data: T) => void
export type WebSocketMessageHandler<T = any> = (message: WebSocketMessage<T>) => void

// WebSocket ready states as constants
export const WS_CONNECTING = 0
export const WS_OPEN = 1
export const WS_CLOSING = 2
export const WS_CLOSED = 3

// === WEBSOCKET CLIENT CLASS ===

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: WebSocketConfigInternal
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private reconnectAttempt = 0
  private messageQueue: WebSocketMessage[] = []
  private listeners: Map<WebSocketEventType, Set<WebSocketListener>> = new Map()
  private messageHandlers: Map<string, Set<WebSocketMessageHandler>> = new Map()
  private forcedClose = false

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols || undefined,
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 1000,
      reconnectDecay: config.reconnectDecay ?? 1.5,
      reconnectAttempts: config.reconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      heartbeatMessage: config.heartbeatMessage ?? 'ping',
      messageQueueSize: config.messageQueueSize ?? 100,
      debug: config.debug ?? false,
    }

    // Initialize listener sets
    this.listeners.set('open', new Set())
    this.listeners.set('close', new Set())
    this.listeners.set('error', new Set())
    this.listeners.set('message', new Set())
    this.listeners.set('reconnect', new Set())
    this.listeners.set('heartbeat', new Set())
  }

  // Connect to WebSocket server
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log('Already connected')
      return
    }

    this.forcedClose = false
    this.log('Connecting to', this.config.url)

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols)
      this.setupEventHandlers()
    } catch (error) {
      this.log('Connection error:', error)
      this.handleReconnect()
    }
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    this.forcedClose = true
    this.clearTimers()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.log('Disconnected')
  }

  // Send message
  send<T = any>(message: WebSocketMessage<T>): boolean {
    const msg: WebSocketMessage<T> = {
      ...message,
      id: message.id || this.generateId(),
      timestamp: message.timestamp || Date.now(),
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg))
        this.log('Sent:', msg)
        return true
      } catch (error) {
        this.log('Send error:', error)
        this.queueMessage(msg)
        return false
      }
    } else {
      this.queueMessage(msg)
      return false
    }
  }

  // Subscribe to connection events
  on(event: WebSocketEventType, listener: WebSocketListener): () => void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.add(listener)
    }
    return () => this.off(event, listener)
  }

  // Unsubscribe from connection events
  off(event: WebSocketEventType, listener: WebSocketListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  // Subscribe to specific message types
  onMessage<T = any>(type: string, handler: WebSocketMessageHandler<T>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler as WebSocketMessageHandler)
    return () => this.offMessage(type, handler)
  }

  // Unsubscribe from specific message types
  offMessage<T = any>(type: string, handler: WebSocketMessageHandler<T>): void {
    const handlers = this.messageHandlers.get(type)
    if (handlers) {
      handlers.delete(handler as WebSocketMessageHandler)
    }
  }

  // Get connection state
  getState(): number {
    return this.ws?.readyState ?? WS_CLOSED
  }

  // Check if connected
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // Setup WebSocket event handlers
  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      this.log('Connected')
      this.reconnectAttempt = 0
      this.startHeartbeat()
      this.flushMessageQueue()
      this.emit('open', null)
    }

    this.ws.onclose = (event) => {
      this.log('Closed:', event.code, event.reason)
      this.clearTimers()
      this.emit('close', event)
      
      if (!this.forcedClose) {
        this.handleReconnect()
      }
    }

    this.ws.onerror = (event) => {
      this.log('Error:', event)
      this.emit('error', event)
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        this.log('Received:', message)
        
        // Emit to general message listeners
        this.emit('message', message)
        
        // Emit to specific message type handlers
        if (message.type) {
          const handlers = this.messageHandlers.get(message.type)
          if (handlers) {
            handlers.forEach(handler => handler(message))
          }
        }
      } catch (error) {
        this.log('Parse error:', error)
        this.emit('message', event.data)
      }
    }
  }

  // Handle reconnection
  private handleReconnect(): void {
    if (!this.config.reconnect || this.forcedClose) return
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      this.log('Max reconnect attempts reached')
      return
    }

    const delay = this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempt)
    this.reconnectAttempt++

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.emit('reconnect', { attempt: this.reconnectAttempt })
      this.connect()
    }, delay)
  }

  // Start heartbeat
  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return

    this.heartbeatTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'heartbeat', payload: this.config.heartbeatMessage })
        this.emit('heartbeat', { timestamp: Date.now() })
      }
    }, this.config.heartbeatInterval)
  }

  // Clear all timers
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Queue message for later sending
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      this.messageQueue.shift() // Remove oldest message
    }
    this.messageQueue.push(message)
    this.log('Message queued:', message)
  }

  // Flush message queue
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return

    this.log(`Flushing ${this.messageQueue.length} queued messages`)
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.send(message)
      }
    }
  }

  // Emit event to listeners
  private emit(event: WebSocketEventType, data: any): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(data))
    }
  }

  // Generate unique message ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Debug logging
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args)
    }
  }
}

// === HELPER FUNCTIONS ===

export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
  return new WebSocketClient(config)
}

// === REACT HOOK ===

export function useWebSocket(config: WebSocketConfig) {
  const [client] = React.useState(() => createWebSocketClient(config))
  const [connected, setConnected] = React.useState(false)
  const [error, setError] = React.useState<Event | null>(null)

  React.useEffect(() => {
    const unsubOpen = client.on('open', () => setConnected(true))
    const unsubClose = client.on('close', () => setConnected(false))
    const unsubError = client.on('error', (e) => setError(e))

    client.connect()

    return () => {
      unsubOpen()
      unsubClose()
      unsubError()
      client.disconnect()
    }
  }, [client])

  return {
    client,
    connected,
    error,
    send: client.send.bind(client),
    onMessage: client.onMessage.bind(client),
  }
}

// === EXAMPLE USAGE ===

/*
// Create client
const ws = createWebSocketClient({
  url: 'wss://api.example.com',
  reconnect: true,
  heartbeatInterval: 30000,
  debug: true,
})

// Connect
ws.connect()

// Listen for connection events
ws.on('open', () => console.log('Connected!'))
ws.on('close', () => console.log('Disconnected!'))
ws.on('error', (error) => console.error('Error:', error))

// Subscribe to specific message types
ws.onMessage('notification', (message) => {
  console.log('Notification:', message.payload)
})

ws.onMessage('data-update', (message) => {
  console.log('Data update:', message.payload)
})

// Send messages
ws.send({ type: 'subscribe', payload: { channel: 'updates' } })
ws.send({ type: 'action', payload: { action: 'refresh' } })

// React hook usage
function MyComponent() {
  const { connected, send, onMessage } = useWebSocket({
    url: 'wss://api.example.com',
  })

  React.useEffect(() => {
    const unsubscribe = onMessage('notification', (msg) => {
      console.log('Got notification:', msg.payload)
    })
    return unsubscribe
  }, [onMessage])

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={() => send({ type: 'ping' })}>Send Ping</button>
    </div>
  )
}

// Disconnect when done
ws.disconnect()
*/

// Note: React import for the hook
import React from 'react'

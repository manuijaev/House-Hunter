class PaymentWebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isConnected = false;
    this.listeners = new Set();
  }

  connect(userId, token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (!userId || !token) {
      console.error('User ID and token required for WebSocket connection');
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/payment-completions/?token=${token}`;

    console.log('🔌 Connecting to payment completion WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Payment completion WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received payment WebSocket message:', data);

          if (data.type === 'payment_completed') {
            console.log('💰 Payment completed for house:', data.house_id);

            // Notify all listeners
            this.listeners.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error('Error in payment WebSocket listener:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Payment completion WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect(userId, token);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Payment completion WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  attemptReconnect(userId, token) {
    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);

    setTimeout(() => {
      this.connect(userId, token);
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  disconnect() {
    if (this.ws) {
      console.log('🔌 Manually disconnecting payment completion WebSocket');
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : -1,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export a singleton instance
export const paymentWebSocket = new PaymentWebSocketManager();
export default paymentWebSocket;
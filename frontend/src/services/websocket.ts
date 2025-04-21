import { ServerUpdatePacket, ClientUpdatePacket, Pixel } from '../types';

type WebSocketHandler = (update: ServerUpdatePacket) => void;

export class GridWebSocketService {
    private ws: WebSocket | null = null;
    private updateHandler: WebSocketHandler | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    constructor() {
        this.connect();
    }

    private connect() {
        this.ws = new WebSocket('ws://localhost:8080/ws');

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
            if (!this.updateHandler) return;
            
            try {
                const update = JSON.parse(event.data) as ServerUpdatePacket;
                this.updateHandler(update);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    public subscribe(handler: WebSocketHandler) {
        this.updateHandler = handler;
    }

    public unsubscribe() {
        this.updateHandler = null;
        this.cleanup();
    }

    public setUserPixel(pixel: Pixel) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            return;
        }

        const packet: ClientUpdatePacket = {
            type: 'UPDATE',
            data: pixel
        };

        this.ws.send(JSON.stringify(packet));
    }

    private cleanup() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
} 
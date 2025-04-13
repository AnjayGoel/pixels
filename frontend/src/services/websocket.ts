import { WebSocketUpdate, Pixel } from '../types';
import { COLORS } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';

type WebSocketHandler = (update: WebSocketUpdate) => void;

export class GridWebSocketService {
    private updateHandler: WebSocketHandler | null = null;
    private pixelInterval: ReturnType<typeof setInterval> | null = null;
    private batchInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.setupMockUpdates();
    }

    public subscribe(handler: WebSocketHandler) {
        this.updateHandler = handler;
    }

    public unsubscribe() {
        this.updateHandler = null;
        this.cleanup();
    }

    public setUserPixel(pixel: Pixel) {
        if (!this.updateHandler) return;
        this.updateHandler({
            type: 'PIXEL_UPDATE',
            data: [pixel]
        });
    }

    private cleanup() {
        if (this.pixelInterval) {
            clearInterval(this.pixelInterval);
            this.pixelInterval = null;
        }
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
    }

    private setupMockUpdates() {
        // Regular single pixel updates
        this.pixelInterval = setInterval(() => {
            if (!this.updateHandler) return;

            // Generate multiple pixels at once
            const numPixels = Math.floor(Math.random() * 5) + 3; // 3-7 pixels per update
            const pixels: Pixel[] = [];
            
            for (let i = 0; i < numPixels; i++) {
                const x = Math.floor(Math.random() * GRID_CONSTANTS.SIZE);
                const y = Math.floor(Math.random() * GRID_CONSTANTS.SIZE);
                const color = Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)];
                pixels.push({ x, y, color });
            }

            this.updateHandler({
                type: 'PIXEL_UPDATE',
                data: pixels
            });
        }, 1000); // Update every second

        // Batch updates
        this.batchInterval = setInterval(() => {
            if (!this.updateHandler) return;

            const size = Math.floor(Math.random() * 15) + 10; // 10-24 size
            const startX = Math.floor(Math.random() * (GRID_CONSTANTS.SIZE - size));
            const startY = Math.floor(Math.random() * (GRID_CONSTANTS.SIZE - size));

            const batchGrid = Array(size).fill(null).map(() =>
                Array(size).fill(null).map(() => {
                    if (Math.random() > 0.7) { // Increased density from 0.9 to 0.7
                        return Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)];
                    } else {
                        return COLORS.WHITE;
                    }
                })
            );

            this.updateHandler({
                type: 'BATCH_UPDATE',
                data: { startX, startY, grid: batchGrid }
            });
        }, 3000); // Update every 3 seconds
    }
} 
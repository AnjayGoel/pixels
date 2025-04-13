import { createContext, useContext, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Pixel, WebSocketUpdate, BatchUpdate } from '../types';
import { GridWebSocketService } from '../services/websocket';

interface PixelStreamContextType {
    subscribe: (callback: (pixels: Pixel[]) => void) => void;
    unsubscribe: (callback: (pixels: Pixel[]) => void) => void;
    placePixel: (pixel: Pixel) => void;
}

const PixelStreamContext = createContext<PixelStreamContextType | null>(null);

export function PixelStreamProvider({ children }: { children: ReactNode }) {
    const subscribers = useRef<Set<(pixels: Pixel[]) => void>>(new Set());
    const wsService = useRef<GridWebSocketService | null>(null);

    // Handle WebSocket updates
    const handleWebSocketMessage = useCallback((update: WebSocketUpdate) => {
        if (update.type === 'PIXEL_UPDATE') {
            const pixels = update.data as Pixel[];
            subscribers.current.forEach(callback => callback(pixels));
        } else if (update.type === 'BATCH_UPDATE') {
            const batchUpdate = update.data as BatchUpdate;
            const { startX, startY, grid } = batchUpdate;
            const pixels: Pixel[] = [];
            
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[y].length; x++) {
                    const colorCode = grid[y][x];
                    if (colorCode !== undefined) {
                        pixels.push({
                            x: startX + x,
                            y: startY + y,
                            color: colorCode
                        });
                    }
                }
            }
            
            if (pixels.length > 0) {
                subscribers.current.forEach(callback => callback(pixels));
            }
        }
    }, []);

    // Initialize WebSocket service
    useEffect(() => {
        wsService.current = new GridWebSocketService();
        wsService.current.subscribe(handleWebSocketMessage);

        return () => {
            wsService.current?.unsubscribe();
        };
    }, [handleWebSocketMessage]);

    const subscribe = useCallback((callback: (pixels: Pixel[]) => void) => {
        subscribers.current.add(callback);
    }, []);

    const unsubscribe = useCallback((callback: (pixels: Pixel[]) => void) => {
        subscribers.current.delete(callback);
    }, []);

    const placePixel = useCallback((pixel: Pixel) => {
        wsService.current?.setUserPixel(pixel);
    }, []);

    return (
        <PixelStreamContext.Provider value={{ subscribe, unsubscribe, placePixel }}>
            {children}
        </PixelStreamContext.Provider>
    );
}

export function usePixelStream() {
    const context = useContext(PixelStreamContext);
    if (!context) {
        throw new Error('usePixelStream must be used within a PixelStreamProvider');
    }
    return context;
} 
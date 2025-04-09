import { useRef, useState, useCallback, useEffect } from 'react';
import { Pixel, WebSocketUpdate, BatchUpdate } from '../types';
import { COLORS } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';
import { GridWebSocketService } from '../services/websocket';

export function useGrid() {
    const initialGrid = Array(GRID_CONSTANTS.SIZE).fill(null)
        .map(() => Array(GRID_CONSTANTS.SIZE).fill(COLORS.WHITE));
    
    const gridRef = useRef<number[][]>(initialGrid);
    const [gridVersion, setGridVersion] = useState(0);
    const [lastPlacedTime, setLastPlacedTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [isDisabled, setIsDisabled] = useState(false);
    const wsService = useRef<GridWebSocketService | null>(null);

    // Handle WebSocket updates
    const handleWebSocketMessage = useCallback((update: WebSocketUpdate) => {
        if (update.type === 'PIXEL_UPDATE') {
            const pixel = update.data as Pixel;
            gridRef.current[pixel.y][pixel.x] = pixel.color;
            setGridVersion(v => v + 1);
        } else if (update.type === 'BATCH_UPDATE') {
            const { startX, startY, grid } = update.data as BatchUpdate;
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[y].length; x++) {
                    const targetY = startY + y;
                    const targetX = startX + x;
                    if (targetY >= 0 && targetY < gridRef.current.length &&
                        targetX >= 0 && targetX < gridRef.current[0].length &&
                        grid[y][x] !== COLORS.WHITE) {
                        gridRef.current[targetY][targetX] = grid[y][x];
                    }
                }
            }
            setGridVersion(v => v + 1);
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

    // Handle cooldown timer
    useEffect(() => {
        if (!lastPlacedTime) {
            setIsDisabled(false);
            return;
        }

        const interval = setInterval(() => {
            const timeLeft = Math.max(0, 3 - (Date.now() - lastPlacedTime) / 1000);
            setCountdown(Math.ceil(timeLeft));
            setIsDisabled(timeLeft > 0);
        }, 100);

        return () => clearInterval(interval);
    }, [lastPlacedTime]);

    const handlePixelPlace = useCallback((pixel: Pixel) => {
        if (lastPlacedTime && Date.now() - lastPlacedTime < 3000) {
            return;
        }

        setLastPlacedTime(Date.now());
        wsService.current?.setUserPixel(pixel);
    }, [lastPlacedTime]);

    return {
        grid: gridRef.current,
        isDisabled,
        countdown,
        handlePixelPlace
    };
} 
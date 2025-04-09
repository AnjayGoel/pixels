export interface Pixel {
    x: number;
    y: number;
    color: number;
}

export interface GridState {
    grid: number[][];
    lastUpdate: number | null;
}

export interface BatchUpdate {
    startX: number;
    startY: number;
    grid: number[][];
}

export interface WebSocketUpdate {
    type: 'PIXEL_UPDATE' | 'GRID_REFRESH' | 'BATCH_UPDATE';
    data: Pixel | number[][] | BatchUpdate;
} 
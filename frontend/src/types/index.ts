export interface Pixel {
    x: number;
    y: number;
    color: number;
}

export interface GridState {
    grid: number[][];
    lastUpdate: number | null;
}

export interface WebSocketUpdate {
    type: 'PIXEL_UPDATE' | 'GRID_REFRESH';
    data: Pixel | number[][];
} 
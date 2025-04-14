export interface Pixel {
    x: number;
    y: number;
    color: number;
}

export interface BatchUpdate {
    startX: number;
    startY: number;
    grid: number[][];
}

export interface WebSocketUpdate {
    type: 'PIXEL_UPDATE' | 'BATCH_UPDATE';
    data: Pixel[]  | BatchUpdate;
} 
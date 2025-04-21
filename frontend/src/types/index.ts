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

export interface ServerUpdatePacket {
    type: 'LIVE_UPDATE' | 'BATCH_UPDATE';
    data: Pixel[] | BatchUpdate;
}

export interface ClientUpdatePacket {
    type: 'UPDATE';
    data: Pixel;
} 
import { Stage, Layer, Rect } from 'react-konva';
import { Paper } from '@mui/material';
import { useRef, useEffect, useCallback, useState } from 'react';
import Konva from 'konva';
import { useConfig } from '../contexts/ConfigContext';

interface MiniMapProps {
    viewportBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    onViewportChange: (x: number, y: number) => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
    viewportBounds,
    onViewportChange,
}) => {
    const config = useConfig()
    const MINI_MAP_SIZE = 150;
    const MINI_PIXEL_SIZE = MINI_MAP_SIZE / config.gridWidth;
    const UPDATE_THROTTLE = 16;
    const lastUpdateTimeRef = useRef<number>(0);
    const [isDragging, setIsDragging] = useState(false);
    const viewportRef = useRef<Konva.Rect>(null);

    useEffect(() => {
        if (viewportRef.current && !isDragging) {
            viewportRef.current.x(viewportBounds.x * MINI_PIXEL_SIZE);
            viewportRef.current.y(viewportBounds.y * MINI_PIXEL_SIZE);
            viewportRef.current.width(viewportBounds.width * MINI_PIXEL_SIZE);
            viewportRef.current.height(viewportBounds.height * MINI_PIXEL_SIZE);
        }
    }, [viewportBounds, isDragging, MINI_PIXEL_SIZE]);

    const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        const stage = e.target.getStage();
        const point = stage.getPointerPosition();

        const x = (point.x / MINI_MAP_SIZE) * config.gridWidth;
        const y = (point.y / MINI_MAP_SIZE) * config.gridHeight;

        onViewportChange(x, y);
    }, [onViewportChange]);

    const handleViewportDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleViewportDrag = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        if (!isDragging) return;

        const viewport = e.target;
        const x = viewport.x() / MINI_PIXEL_SIZE;
        const y = viewport.y() / MINI_PIXEL_SIZE;

        onViewportChange(x, y);
    }, [isDragging, onViewportChange, MINI_PIXEL_SIZE]);

    const handleViewportDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        setIsDragging(false);

        const viewport = e.target;
        const x = viewport.x() / MINI_PIXEL_SIZE;
        const y = viewport.y() / MINI_PIXEL_SIZE;

        onViewportChange(x, y);
    }, [onViewportChange, MINI_PIXEL_SIZE]);

    return (
        <Paper className="fixed top-4 right-4 p-2 hidden sm:block" elevation={3}>
            <Stage
                width={MINI_MAP_SIZE}
                height={MINI_MAP_SIZE}
                onClick={handleClick}
            >
                <Layer>
                    <Rect
                        x={0}
                        y={0}
                        width={MINI_MAP_SIZE}
                        height={MINI_MAP_SIZE}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={1}
                    />
                </Layer>
                <Layer>
                    <Rect
                        ref={viewportRef}
                        x={viewportBounds.x * MINI_PIXEL_SIZE}
                        y={viewportBounds.y * MINI_PIXEL_SIZE}
                        width={viewportBounds.width * MINI_PIXEL_SIZE}
                        height={viewportBounds.height * MINI_PIXEL_SIZE}
                        stroke="#000000"
                        strokeWidth={1}
                        fill="rgba(255, 255, 255, 0.1)"
                        draggable
                        onDragStart={handleViewportDragStart}
                        onDrag={handleViewportDrag}
                        onDragEnd={handleViewportDragEnd}
                        dragBoundFunc={(pos) => {
                            return {
                                x: Math.max(0, Math.min(MINI_MAP_SIZE - viewportBounds.width * MINI_PIXEL_SIZE, pos.x)),
                                y: Math.max(0, Math.min(MINI_MAP_SIZE - viewportBounds.height * MINI_PIXEL_SIZE, pos.y))
                            };
                        }}
                    />
                </Layer>
            </Stage>
        </Paper>
    );
}; 
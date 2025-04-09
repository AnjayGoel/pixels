import { Stage, Layer, Shape, Group, Rect } from 'react-konva';
import { COLOR_HEX_MAP } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';
import { Paper } from '@mui/material';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Konva from 'konva';

interface MiniMapProps {
    grid: number[][];
    viewportBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    onViewportChange: (x: number, y: number) => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
    grid,
    viewportBounds,
    onViewportChange,
}) => {
    const { SIZE: GRID_SIZE, PIXEL_SIZE } = GRID_CONSTANTS;
    const MINI_MAP_SIZE = 150;
    const MINI_PIXEL_SIZE = MINI_MAP_SIZE / GRID_SIZE;
    const layerRef = useRef<Konva.Layer>(null);
    const lastGridRef = useRef<string>('');
    const lastViewportRef = useRef<string>('');
    const UPDATE_THROTTLE = 16; // For grid updates only
    const lastUpdateTimeRef = useRef<number>(0);
    const [isDragging, setIsDragging] = useState(false);
    const viewportRef = useRef<Konva.Rect>(null);

    // Memoize the grid string representation for change detection
    const gridString = useMemo(() => JSON.stringify(grid), [grid]);
    const viewportString = useMemo(() => JSON.stringify(viewportBounds), [viewportBounds]);

    const drawMiniMap = useCallback(() => {
        if (!layerRef.current) return;
        
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;
        
        if (lastGridRef.current === gridString && lastViewportRef.current === viewportString) {
            return;
        }
        lastGridRef.current = gridString;
        lastViewportRef.current = viewportString;
        
        layerRef.current.destroyChildren();
        
        const group = new Konva.Group();
        
        const gridShape = new Konva.Shape({
            sceneFunc: (context, shape) => {
                const ctx = context._context;
                
                for (let y = 0; y < GRID_SIZE; y++) {
                    for (let x = 0; x < GRID_SIZE; x++) {
                        const colorCode = grid[y][x];
                        if (colorCode !== undefined && COLOR_HEX_MAP[colorCode]) {
                            ctx.fillStyle = COLOR_HEX_MAP[colorCode];
                            ctx.fillRect(x * MINI_PIXEL_SIZE, y * MINI_PIXEL_SIZE, MINI_PIXEL_SIZE, MINI_PIXEL_SIZE);
                        }
                    }
                }
            },
            width: MINI_MAP_SIZE,
            height: MINI_MAP_SIZE,
            listening: false,
        });
        
        group.add(gridShape);
        layerRef.current.add(group);
        layerRef.current.batchDraw();
    }, [grid, gridString, MINI_PIXEL_SIZE, GRID_SIZE]);

    useEffect(() => {
        drawMiniMap();
    }, [drawMiniMap]);

    useEffect(() => {
        if (viewportRef.current && !isDragging) {
            viewportRef.current.x(viewportBounds.x * MINI_PIXEL_SIZE);
            viewportRef.current.y(viewportBounds.y * MINI_PIXEL_SIZE);
            viewportRef.current.width(viewportBounds.width * MINI_PIXEL_SIZE);
            viewportRef.current.height(viewportBounds.height * MINI_PIXEL_SIZE);
        }
    }, [viewportBounds, isDragging, MINI_PIXEL_SIZE]);

    const handleClick = useCallback((e: any) => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;
        
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        
        const x = (point.x / MINI_MAP_SIZE) * GRID_SIZE;
        const y = (point.y / MINI_MAP_SIZE) * GRID_SIZE;
        
        onViewportChange(x, y);
    }, [onViewportChange, GRID_SIZE]);

    const handleViewportDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleViewportDrag = useCallback((e: any) => {
        if (!isDragging) return;

        const viewport = e.target;
        const x = viewport.x() / MINI_PIXEL_SIZE;
        const y = viewport.y() / MINI_PIXEL_SIZE;
        
        onViewportChange(x, y);
    }, [isDragging, onViewportChange, MINI_PIXEL_SIZE]);

    const handleViewportDragEnd = useCallback((e: any) => {
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
                <Layer ref={layerRef}>
                    {/* Grid is drawn dynamically in the drawMiniMap function */}
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
import { Stage, Layer, Shape, Group, Rect } from 'react-konva';
import { COLOR_HEX_MAP } from '../constants/colors';
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
    const MINI_MAP_SIZE = 150;
    const GRID_SIZE = 100;
    const PIXEL_SIZE = MINI_MAP_SIZE / GRID_SIZE;
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
            // Throttle updates to avoid excessive rendering
            return;
        }
        lastUpdateTimeRef.current = now;
        
        // Skip redrawing if grid and viewport haven't changed
        if (lastGridRef.current === gridString && lastViewportRef.current === viewportString) {
            return;
        }
        lastGridRef.current = gridString;
        lastViewportRef.current = viewportString;
        
        // Clear the layer
        layerRef.current.destroyChildren();
        
        // Create a single group
        const group = new Konva.Group();
        
        // Create a single shape for the entire grid
        const gridShape = new Konva.Shape({
            sceneFunc: (context, shape) => {
                const ctx = context._context;
                
                // Draw each pixel
                for (let y = 0; y < GRID_SIZE; y++) {
                    for (let x = 0; x < GRID_SIZE; x++) {
                        const colorCode = grid[y][x];
                        ctx.fillStyle = COLOR_HEX_MAP[colorCode];
                        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
                    }
                }
            },
            width: MINI_MAP_SIZE,
            height: MINI_MAP_SIZE,
            listening: false, // Disable event listening for better performance
        });
        
        group.add(gridShape);
        layerRef.current.add(group);
        layerRef.current.batchDraw();
    }, [grid, gridString]);

    useEffect(() => {
        drawMiniMap();
    }, [drawMiniMap]);

    // Update viewport position when viewportBounds changes
    useEffect(() => {
        if (viewportRef.current && !isDragging) {
            viewportRef.current.x(viewportBounds.x * PIXEL_SIZE);
            viewportRef.current.y(viewportBounds.y * PIXEL_SIZE);
            viewportRef.current.width(viewportBounds.width * PIXEL_SIZE);
            viewportRef.current.height(viewportBounds.height * PIXEL_SIZE);
        }
    }, [viewportBounds, isDragging, PIXEL_SIZE]);

    // Throttled click handler
    const handleClick = useCallback((e: any) => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;
        
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        
        // Convert mini-map coordinates to main grid coordinates
        const x = (point.x / MINI_MAP_SIZE) * GRID_SIZE;
        const y = (point.y / MINI_MAP_SIZE) * GRID_SIZE;
        
        onViewportChange(x, y);
    }, [onViewportChange]);

    // Handle viewport drag start
    const handleViewportDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    // Handle viewport drag - no throttling for real-time updates
    const handleViewportDrag = useCallback((e: any) => {
        if (!isDragging) return;

        const viewport = e.target;
        // Convert the viewport position to grid coordinates
        const x = viewport.x() / PIXEL_SIZE;
        const y = viewport.y() / PIXEL_SIZE;
        
        // Update the main canvas position immediately
        onViewportChange(x, y);
    }, [isDragging, onViewportChange, PIXEL_SIZE]);

    // Handle viewport drag end
    const handleViewportDragEnd = useCallback((e: any) => {
        setIsDragging(false);
        
        const viewport = e.target;
        // Convert the viewport position to grid coordinates
        const x = viewport.x() / PIXEL_SIZE;
        const y = viewport.y() / PIXEL_SIZE;
        
        onViewportChange(x, y);
    }, [onViewportChange, PIXEL_SIZE]);

    return (
        <Paper className="fixed top-4 right-4 p-2" elevation={3}>
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
                        x={viewportBounds.x * PIXEL_SIZE}
                        y={viewportBounds.y * PIXEL_SIZE}
                        width={viewportBounds.width * PIXEL_SIZE}
                        height={viewportBounds.height * PIXEL_SIZE}
                        stroke="#000000"
                        strokeWidth={1}
                        fill="rgba(255, 255, 255, 0.1)"
                        draggable
                        onDragStart={handleViewportDragStart}
                        onDrag={handleViewportDrag}
                        onDragEnd={handleViewportDragEnd}
                        dragBoundFunc={(pos) => {
                            // Constrain dragging to the minimap bounds
                            return {
                                x: Math.max(0, Math.min(MINI_MAP_SIZE - viewportBounds.width * PIXEL_SIZE, pos.x)),
                                y: Math.max(0, Math.min(MINI_MAP_SIZE - viewportBounds.height * PIXEL_SIZE, pos.y))
                            };
                        }}
                    />
                </Layer>
            </Stage>
        </Paper>
    );
}; 
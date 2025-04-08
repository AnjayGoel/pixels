import { Stage, Layer, Shape, Group } from 'react-konva';
import { COLOR_HEX_MAP } from '../constants/colors';
import { Paper } from '@mui/material';
import { useRef, useEffect, useCallback, useMemo } from 'react';
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
    const UPDATE_THROTTLE = 100; // Lower frequency updates for mini-map
    const lastUpdateTimeRef = useRef<number>(0);

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
                
                // Draw viewport indicator
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    (viewportBounds.x / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.y / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.width / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.height / GRID_SIZE) * MINI_MAP_SIZE
                );
                
                // Add semi-transparent fill
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(
                    (viewportBounds.x / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.y / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.width / GRID_SIZE) * MINI_MAP_SIZE,
                    (viewportBounds.height / GRID_SIZE) * MINI_MAP_SIZE
                );
            },
            width: MINI_MAP_SIZE,
            height: MINI_MAP_SIZE,
            listening: false, // Disable event listening for better performance
        });
        
        group.add(gridShape);
        layerRef.current.add(group);
        layerRef.current.batchDraw();
    }, [grid, gridString, viewportBounds, viewportString]);

    useEffect(() => {
        drawMiniMap();
    }, [drawMiniMap]);

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

    return (
        <Paper
            className="fixed bottom-24 left-4 p-2 shadow-md border border-gray-200"
            elevation={1}
        >
            <Stage
                width={MINI_MAP_SIZE}
                height={MINI_MAP_SIZE}
                onClick={handleClick}
                style={{ background: 'white' }}
            >
                <Layer ref={layerRef}>
                    {/* Mini-map is drawn dynamically in the drawMiniMap function */}
                </Layer>
            </Stage>
        </Paper>
    );
}; 
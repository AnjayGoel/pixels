import { Stage, Layer, Rect, Group } from 'react-konva';
import { Pixel } from '../types';
import { COLOR_HEX_MAP } from '../constants/colors';
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import Konva from 'konva';
import { ZoomControls } from './ZoomControls';
import { MiniMap } from './MiniMap';

interface GridProps {
    grid: number[][];
    selectedColor: number | null;
    onPixelPlace: (pixel: Pixel) => void;
    disabled: boolean;
}

export const Grid: React.FC<GridProps> = ({ grid, selectedColor, onPixelPlace, disabled }) => {
    const [scale, setScale] = useState(5);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const gridShapeRef = useRef<Konva.Shape | null>(null);
    const lastGridRef = useRef<string>('');
    const PIXEL_SIZE = 1;
    const GRID_SIZE = 100;
    const STAGE_SIZE = 800;
    const MIN_SCALE = 1;
    const MAX_SCALE = 40;
    const UPDATE_THROTTLE = 8; // Increase to ~120fps
    const lastUpdateTimeRef = useRef<number>(0);

    // Memoize the grid string representation for change detection
    const gridString = useMemo(() => JSON.stringify(grid), [grid]);

    // Draw the grid on a canvas for better performance
    const drawGrid = useCallback(() => {
        if (!layerRef.current) return;
        
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            // Throttle updates to avoid excessive rendering
            return;
        }
        lastUpdateTimeRef.current = now;
        
        // Skip redrawing if grid hasn't changed
        if (lastGridRef.current === gridString) {
            return;
        }
        lastGridRef.current = gridString;
        
        // Clear the layer
        layerRef.current.destroyChildren();
        
        // Create a single group for all pixels
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
            width: GRID_SIZE,
            height: GRID_SIZE,
            listening: true,
        });
        
        gridShapeRef.current = gridShape;
        group.add(gridShape);
        layerRef.current.add(group);
        layerRef.current.batchDraw();
    }, [grid, gridString]);

    // Redraw when grid changes
    useEffect(() => {
        drawGrid();
    }, [drawGrid]);

    // Throttled wheel handler
    const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;
        
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        const oldScale = stage!.scaleX();
        
        const mousePointTo = {
            x: stage!.getPointerPosition()!.x / oldScale - stage!.x() / oldScale,
            y: stage!.getPointerPosition()!.y / oldScale - stage!.y() / oldScale,
        };

        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, 
            e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
        ));
        
        setScale(newScale);
        setPosition({
            x: -(mousePointTo.x - stage!.getPointerPosition()!.x / newScale) * newScale,
            y: -(mousePointTo.y - stage!.getPointerPosition()!.y / newScale) * newScale,
        });
    }, []);

    // Throttled click handler
    const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (disabled || selectedColor === null) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        const stage = e.target.getStage();
        const point = stage!.getPointerPosition();
        const x = Math.floor((point!.x - position.x) / (PIXEL_SIZE * scale));
        const y = Math.floor((point!.y - position.y) / (PIXEL_SIZE * scale));

        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            onPixelPlace({ x, y, color: selectedColor });
        }
    }, [disabled, position, scale, selectedColor, onPixelPlace]);

    // Throttled drag end handler
    const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;
        
        setPosition({
            x: e.target.x(),
            y: e.target.y(),
        });
    }, []);

    const handleZoomIn = useCallback(() => {
        const newScale = Math.min(MAX_SCALE, scale * 1.5);
        setScale(newScale);
    }, [scale]);

    const handleZoomOut = useCallback(() => {
        const newScale = Math.max(MIN_SCALE, scale / 1.5);
        setScale(newScale);
    }, [scale]);

    const handleReset = useCallback(() => {
        setScale(5);
        setPosition({ x: 0, y: 0 });
    }, []);

    const handleMiniMapViewportChange = useCallback((x: number, y: number) => {
        setPosition({
            x: -x * scale,
            y: -y * scale,
        });
    }, [scale]);

    const getViewportBounds = useCallback(() => {
        if (!stageRef.current) return { x: 0, y: 0, width: GRID_SIZE, height: GRID_SIZE };
        
        const stage = stageRef.current;
        const viewportWidth = STAGE_SIZE / scale;
        const viewportHeight = STAGE_SIZE / scale;
        
        return {
            x: Math.max(0, -position.x / scale),
            y: Math.max(0, -position.y / scale),
            width: Math.min(GRID_SIZE, viewportWidth),
            height: Math.min(GRID_SIZE, viewportHeight),
        };
    }, [position, scale]);

    // Memoize viewport bounds to prevent unnecessary re-renders
    const viewportBounds = useMemo(() => getViewportBounds(), [getViewportBounds]);

    return (
        <>
            <Stage
                ref={stageRef}
                width={window.innerWidth}
                height={window.innerHeight}
                onWheel={handleWheel}
                onClick={handleClick}
                scaleX={scale}
                scaleY={scale}
                className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                style={{
                    cursor: disabled ? 'not-allowed' : selectedColor === null ? 'pointer' : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}"/></svg>') 8 8, auto`,
                    background: 'white',
                    position: 'fixed',
                    top: 0,
                    left: 0
                }}
                draggable
                onDragEnd={handleDragEnd}
                x={position.x}
                y={position.y}
            >
                <Layer ref={layerRef}>
                    {/* Grid is drawn dynamically in the drawGrid function */}
                </Layer>
            </Stage>

            <ZoomControls
                scale={scale}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
            />

            <MiniMap
                grid={grid}
                viewportBounds={viewportBounds}
                onViewportChange={handleMiniMapViewportChange}
            />
        </>
    );
}; 
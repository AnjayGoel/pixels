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
    const PIXEL_SIZE = 8;
    const GRID_SIZE = 100;
    const STAGE_SIZE = 800;
    const MIN_SCALE = 0.1;
    const MAX_SCALE = 40;
    const UPDATE_THROTTLE = 8; // Increase to ~120fps

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ 
        x: window.innerWidth / 2 - (GRID_SIZE * PIXEL_SIZE) / 2, 
        y: window.innerHeight / 2 - (GRID_SIZE * PIXEL_SIZE) / 2 
    });
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const gridShapeRef = useRef<Konva.Shape | null>(null);
    const lastGridRef = useRef<string>('');
    const lastUpdateTimeRef = useRef<number>(0);

    // Memoize the grid string representation for change detection
    const gridString = useMemo(() => JSON.stringify(grid), [grid]);

    // Draw the grid on a canvas for better performance
    const drawGrid = useCallback(() => {
        if (!layerRef.current) return;
        
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
                
                // Draw a subtle outline around the entire grid
                ctx.strokeStyle = '#888888';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, GRID_SIZE * PIXEL_SIZE, GRID_SIZE * PIXEL_SIZE);
            },
            width: GRID_SIZE * PIXEL_SIZE,
            height: GRID_SIZE * PIXEL_SIZE,
            listening: true,
        });
        
        gridShapeRef.current = gridShape;
        group.add(gridShape);
        layerRef.current.add(group);
        layerRef.current.batchDraw();
    }, [grid]);

    // Redraw when grid changes
    useEffect(() => {
        // Always redraw when grid changes
        drawGrid();
    }, [grid, drawGrid]);

    // Force redraw on scale changes
    useEffect(() => {
        drawGrid();
    }, [scale, drawGrid]);

    // Initial setup
    useEffect(() => {
        // Set initial position to center the grid
        setPosition({ 
            x: window.innerWidth / 2 - (GRID_SIZE * PIXEL_SIZE) / 2, 
            y: window.innerHeight / 2 - (GRID_SIZE * PIXEL_SIZE) / 2 
        });
        
        // Initial draw
        drawGrid();
        
        // Force a redraw after a short delay to ensure everything is properly initialized
        const timer = setTimeout(() => {
            drawGrid();
        }, 100);
        
        return () => clearTimeout(timer);
    }, []);

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
        
        // Transform the point to account for stage position and scale
        const transformedPoint = {
            x: (point!.x - position.x) / scale,
            y: (point!.y - position.y) / scale
        };
        
        const x = Math.floor(transformedPoint.x / PIXEL_SIZE);
        const y = Math.floor(transformedPoint.y / PIXEL_SIZE);

        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            onPixelPlace({ x, y, color: selectedColor });
            // Force an immediate redraw after placing a pixel
            setTimeout(() => drawGrid(), 0);
        }
    }, [disabled, position, scale, selectedColor, onPixelPlace, drawGrid]);

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
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const handleMiniMapViewportChange = useCallback((x: number, y: number) => {
        // Convert grid coordinates to stage coordinates
        setPosition({
            x: -x * PIXEL_SIZE * scale,
            y: -y * PIXEL_SIZE * scale,
        });
    }, [scale, PIXEL_SIZE]);

    const getViewportBounds = useCallback(() => {
        if (!stageRef.current) return { x: 0, y: 0, width: GRID_SIZE, height: GRID_SIZE };
        
        const stage = stageRef.current;
        const viewportWidth = window.innerWidth / scale;
        const viewportHeight = window.innerHeight / scale;
        
        // Calculate the visible area in grid coordinates
        const visibleX = -position.x / (PIXEL_SIZE * scale);
        const visibleY = -position.y / (PIXEL_SIZE * scale);
        const visibleWidth = viewportWidth / (PIXEL_SIZE * scale);
        const visibleHeight = viewportHeight / (PIXEL_SIZE * scale);
        
        return {
            x: Math.max(0, visibleX),
            y: Math.max(0, visibleY),
            width: Math.min(GRID_SIZE - visibleX, visibleWidth),
            height: Math.min(GRID_SIZE - visibleY, visibleHeight),
        };
    }, [position, scale]);

    // Memoize viewport bounds to prevent unnecessary re-renders
    const viewportBounds = useMemo(() => getViewportBounds(), [getViewportBounds]);

    return (
        <>
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'white',
                    overflow: 'hidden'
                }}
            >
                <Stage
                    ref={stageRef}
                    width={window.innerWidth}
                    height={window.innerHeight}
                    onWheel={handleWheel}
                    onClick={handleClick}
                    scaleX={scale}
                    scaleY={scale}
                    onMouseEnter={() => {
                        if (!disabled && selectedColor !== null) {
                            // Position the hotspot at the top of the color block
                            document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="8" width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}" stroke="black" stroke-width="1"/></svg>') 16 8, auto`;
                        } else if (!disabled) {
                            document.body.style.cursor = 'pointer';
                        } else {
                            document.body.style.cursor = 'not-allowed';
                        }
                    }}
                    onMouseLeave={() => {
                        document.body.style.cursor = 'default';
                    }}
                    style={{
                        background: 'white',
                        position: 'absolute',
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
            </div>

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
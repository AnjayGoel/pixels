import { Stage, Layer } from 'react-konva';
import { Pixel } from '../types';
import { COLOR_HEX_MAP } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';
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
    const { SIZE: GRID_SIZE, PIXEL_SIZE, MIN_SCALE, MAX_SCALE, UPDATE_THROTTLE } = GRID_CONSTANTS;
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const redrawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastDrawnGrid = useRef<string>('');

    // Memoize position and scale to prevent unnecessary re-renders
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({
        x: window.innerWidth / 2 - (GRID_SIZE * PIXEL_SIZE) / 2,
        y: window.innerHeight / 2 - (GRID_SIZE * PIXEL_SIZE) / 2
    });

    // Memoize grid string for change detection
    const gridString = useMemo(() => JSON.stringify(grid), [grid]);

    // Memoize position and scale updates
    const updatePosition = useCallback((newPosition: { x: number; y: number }) => {
        setPosition(newPosition);
    }, []);

    const updateScale = useCallback((newScale: number) => {
        setScale(newScale);
    }, []);

    // Memoize the draw function
    const drawGrid = useCallback(() => {
        if (!layerRef.current) return;

        try {
            // Only redraw if grid has changed
            if (gridString === lastDrawnGrid.current) return;
            lastDrawnGrid.current = gridString;

            // Clear the layer
            layerRef.current.destroyChildren();

            // Create a single group for all pixels
            const group = new Konva.Group();

            // Create a single shape for the entire grid
            const gridShape = new Konva.Shape({
                sceneFunc: (context) => {
                    const ctx = context._context;

                    // Draw all pixels
                    for (let y = 0; y < GRID_SIZE; y++) {
                        for (let x = 0; x < GRID_SIZE; x++) {
                            const colorCode = grid[y][x];
                            if (colorCode !== undefined && COLOR_HEX_MAP[colorCode]) {
                                ctx.fillStyle = COLOR_HEX_MAP[colorCode];
                                ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
                            }
                        }
                    }
                },
                width: GRID_SIZE * PIXEL_SIZE,
                height: GRID_SIZE * PIXEL_SIZE,
                listening: true,
            });

            // Add a single outline around the entire grid
            const outlineShape = new Konva.Shape({
                sceneFunc: (context) => {
                    const ctx = context._context;
                    ctx.strokeStyle = '#888888';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, 0, GRID_SIZE * PIXEL_SIZE, GRID_SIZE * PIXEL_SIZE);
                },
                width: GRID_SIZE * PIXEL_SIZE,
                height: GRID_SIZE * PIXEL_SIZE,
                listening: false,
            });

            group.add(gridShape);
            group.add(outlineShape);
            layerRef.current.add(group);
            layerRef.current.batchDraw();
        } catch (error) {
            console.error('Error drawing grid:', error);
        }
    }, [grid, PIXEL_SIZE, GRID_SIZE, gridString]);

    // Debounced redraw function with error handling
    const debouncedRedraw = useCallback(() => {
        if (redrawTimeoutRef.current) {
            clearTimeout(redrawTimeoutRef.current);
        }
        redrawTimeoutRef.current = setTimeout(() => {
            try {
                drawGrid();
            } catch (error) {
                console.error('Error in debounced redraw:', error);
            }
        }, 16); // Reduced to ~30fps for stability
    }, [drawGrid]);

    // Single effect for all redraw triggers
    useEffect(() => {
        debouncedRedraw();
    }, [gridString, scale, position, debouncedRedraw]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (redrawTimeoutRef.current) {
                clearTimeout(redrawTimeoutRef.current);
            }
        };
    }, []);

    // Memoize event handlers
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

        const pointerPos = stage!.getPointerPosition();
        if (!pointerPos) return;

        const mousePointTo = {
            x: (pointerPos.x - stage!.x()) / oldScale,
            y: (pointerPos.y - stage!.y()) / oldScale,
        };

        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
            e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
        ));

        const newPos = {
            x: pointerPos.x - mousePointTo.x * newScale,
            y: pointerPos.y - mousePointTo.y * newScale,
        };

        updateScale(newScale);
        updatePosition(newPos);
    }, [updateScale, updatePosition, MIN_SCALE, MAX_SCALE, UPDATE_THROTTLE]);

    const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (disabled || selectedColor === null) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        const stage = e.target.getStage();
        const pointerPos = stage!.getPointerPosition();

        if (!pointerPos) return;

        const stageX = stage!.x();
        const stageY = stage!.y();

        const relativeX = (pointerPos.x - stageX) / scale;
        const relativeY = (pointerPos.y - stageY) / scale;

        const gridX = Math.floor(relativeX / PIXEL_SIZE);
        const gridY = Math.floor(relativeY / PIXEL_SIZE);

        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            onPixelPlace({ x: gridX, y: gridY, color: selectedColor });
        }
    }, [disabled, scale, selectedColor, onPixelPlace, PIXEL_SIZE, GRID_SIZE, UPDATE_THROTTLE]);

    const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        updatePosition({
            x: e.target.x(),
            y: e.target.y(),
        });
    }, [updatePosition, UPDATE_THROTTLE]);

    // Memoize zoom controls
    const handleZoomIn = useCallback(() => {
        const newScale = Math.min(MAX_SCALE, scale * 1.5);
        updateScale(newScale);
    }, [scale, updateScale, MAX_SCALE]);

    const handleZoomOut = useCallback(() => {
        const newScale = Math.max(MIN_SCALE, scale / 1.5);
        updateScale(newScale);
    }, [scale, updateScale, MIN_SCALE]);

    const handleReset = useCallback(() => {
        updateScale(1);
        updatePosition({ x: 0, y: 0 });
    }, [updateScale, updatePosition]);

    const handleMiniMapViewportChange = useCallback((x: number, y: number) => {
        updatePosition({
            x: -x * PIXEL_SIZE * scale,
            y: -y * PIXEL_SIZE * scale,
        });
    }, [scale, updatePosition, PIXEL_SIZE]);

    // Memoize viewport bounds
    const viewportBounds = useMemo(() => {
        if (!stageRef.current) return { x: 0, y: 0, width: GRID_SIZE, height: GRID_SIZE };

        const viewportWidth = window.innerWidth / scale;
        const viewportHeight = window.innerHeight / scale;

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
    }, [position, scale, PIXEL_SIZE, GRID_SIZE]);


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
                    overflow: 'hidden',
                    touchAction: 'none'
                }}
            >
                <Stage
                    ref={stageRef}
                    width={window.innerWidth}
                    height={window.innerHeight}
                    onWheel={handleWheel}
                    onClick={handleClick}
                    onTap={handleClick}
                    scaleX={scale}
                    scaleY={scale}
                    x={position.x}
                    y={position.y}
                    draggable
                    onDragEnd={handleDragEnd}
                    onMouseEnter={() => {
                        if (selectedColor !== null) {
                            document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="8" width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}" stroke="black" stroke-width="1"/></svg>') 16 8, auto`;
                        } else {
                            document.body.style.cursor = 'pointer';
                        }
                    }}
                    onMouseLeave={() => {
                        document.body.style.cursor = 'default';
                    }}
                    onMouseMove={() => {
                        if (selectedColor !== null) {
                            document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="8" width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}" stroke="black" stroke-width="1"/></svg>') 16 8, auto`;
                        } else {
                            document.body.style.cursor = 'pointer';
                        }
                    }}
                >
                    <Layer ref={layerRef} />
                </Stage>
            </div>
            <ZoomControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                scale={scale}
            />
            <MiniMap
                grid={grid}
                viewportBounds={viewportBounds}
                onViewportChange={handleMiniMapViewportChange}
            />
        </>
    );
};
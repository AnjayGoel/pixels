import { Stage, Layer } from 'react-konva';
import { Pixel } from '../types';
import { COLOR_HEX_MAP } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import Konva from 'konva';
import { ZoomControls } from './ZoomControls';
import { MiniMap } from './MiniMap';
import { usePixelStream } from '../contexts/PixelStreamContext';

interface GridProps {
    selectedColor: number | null;
    disabled?: boolean;
    onPixelPlace?: () => void;
}

export const Grid: React.FC<GridProps> = ({ selectedColor, disabled, onPixelPlace }) => {
    const { SIZE: GRID_SIZE, PIXEL_SIZE, MIN_SCALE, MAX_SCALE, UPDATE_THROTTLE } = GRID_CONSTANTS;
    
    // Refs to konva stage and layer
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);


    const lastUpdateTimeRef = useRef<number>(0);
    const pendingPixelsRef = useRef<Pixel[]>([]);
    const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { placePixel } = usePixelStream();

    // Memoize position and scale to prevent unnecessary re-renders
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({
        x: window.innerWidth / 2 - (GRID_SIZE * PIXEL_SIZE) / 2,
        y: window.innerHeight / 2 - (GRID_SIZE * PIXEL_SIZE) / 2
    });

    // Memoize position and scale updates
    const updatePosition = useCallback((newPosition: { x: number; y: number }) => {
        setPosition(newPosition);
    }, []);

    const updateScale = useCallback((newScale: number) => {
        setScale(newScale);
    }, []);

    // Handle pixel updates with debouncing
    const handlePixelUpdates = useCallback((pixels: Pixel[]) => {
        const layer = layerRef.current;
        if (!layer) return;

        // Add new pixels to pending list
        pendingPixelsRef.current.push(...pixels);

        // Clear existing timeout
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
        }

        // Set new timeout for rendering
        renderTimeoutRef.current = setTimeout(() => {
            const group = new Konva.Group();

            // Process all pending pixels
            for (const pixel of pendingPixelsRef.current) {
                const rect = new Konva.Rect({
                    x: pixel.x * PIXEL_SIZE,
                    y: pixel.y * PIXEL_SIZE,
                    width: PIXEL_SIZE,
                    height: PIXEL_SIZE,
                    fill: COLOR_HEX_MAP[pixel.color],
                    listening: false
                });

                group.add(rect);
            }

            // Clear pending pixels
            pendingPixelsRef.current = [];

            // Add group to layer and draw
            if (group.children.length > 0) {
                layer.add(group);
                layer.batchDraw();
            }
        }, 16); // ~60fps
    }, [PIXEL_SIZE]);

    // Subscribe to pixel stream
    const { subscribe, unsubscribe } = usePixelStream();
    useEffect(() => {
        subscribe(handlePixelUpdates);
        return () => unsubscribe(handlePixelUpdates);
    }, [handlePixelUpdates, subscribe, unsubscribe]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current);
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

    const handlePixelPlace = useCallback((x: number, y: number) => {
        if (disabled || selectedColor === null) return;
        const pixel = { x, y, color: selectedColor };
        placePixel(pixel);
        onPixelPlace?.();
    }, [selectedColor, disabled, placePixel, onPixelPlace]);

    const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (disabled) return;
        const stage = e.target.getStage();
        if (!stage) return;
        
        const point = stage.getPointerPosition();
        if (!point) return;
        
        const gridX = Math.floor((point.x - position.x) / (PIXEL_SIZE * scale));
        const gridY = Math.floor((point.y - position.y) / (PIXEL_SIZE * scale));
        
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            handlePixelPlace(gridX, gridY);
        }
    }, [disabled, scale, position, PIXEL_SIZE, GRID_SIZE, handlePixelPlace]);

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
                viewportBounds={viewportBounds}
                onViewportChange={handleMiniMapViewportChange}
            />
        </>
    );
};
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Pixel } from '../types';
import { COLOR_HEX_MAP } from '../constants/colors';
import { GRID_CONSTANTS } from '../constants/grid';
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
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingPixelsRef = useRef<Pixel[]>([]);
    const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { placePixel } = usePixelStream();

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({
        x: window.innerWidth / 2 - (GRID_SIZE * PIXEL_SIZE) / 2,
        y: window.innerHeight / 2 - (GRID_SIZE * PIXEL_SIZE) / 2
    });

    const updatePosition = useCallback((newPosition: { x: number; y: number }) => {
        setPosition(newPosition);
    }, []);

    const updateScale = useCallback((newScale: number) => {
        setScale(newScale);
    }, []);

    // Handle pixel updates with debouncing
    const handlePixelUpdates = useCallback((pixels: Pixel[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Add new pixels to pending list
        pendingPixelsRef.current.push(...pixels);

        // Clear existing timeout
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
        }

        // Set new timeout for rendering
        renderTimeoutRef.current = setTimeout(() => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const copy = [...pendingPixelsRef.current];
            pendingPixelsRef.current = [];

            // Process all pending pixels
            for (const pixel of copy) {
                ctx.fillStyle = COLOR_HEX_MAP[pixel.color];
                ctx.fillRect(
                    pixel.x * PIXEL_SIZE,
                    pixel.y * PIXEL_SIZE,
                    PIXEL_SIZE,
                    PIXEL_SIZE
                );
            }

            // Redraw grid boundary
            ctx.beginPath();
            ctx.rect(0, 0, GRID_SIZE * PIXEL_SIZE, GRID_SIZE * PIXEL_SIZE);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
        }, 16); // ~60fps
    }, [PIXEL_SIZE, GRID_SIZE]);

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

    // Handle wheel events for zooming
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        const scaleBy = 1.1;
        const oldScale = scale;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const mousePointTo = {
            x: (mouseX - position.x) / oldScale,
            y: (mouseY - position.y) / oldScale,
        };

        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
            e.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
        ));

        const newPos = {
            x: mouseX - mousePointTo.x * newScale,
            y: mouseY - mousePointTo.y * newScale,
        };

        updateScale(newScale);
        updatePosition(newPos);
    }, [scale, position, updateScale, updatePosition, MIN_SCALE, MAX_SCALE, UPDATE_THROTTLE]);

    const handlePixelPlace = useCallback((x: number, y: number) => {
        if (disabled || selectedColor === null) return;
        const pixel = { x, y, color: selectedColor };
        placePixel(pixel);
        onPixelPlace?.();
    }, [selectedColor, disabled, placePixel, onPixelPlace]);

    const handleClick = useCallback((e: MouseEvent) => {
        if (disabled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Calculate the grid coordinates
        const gridX = Math.floor((e.clientX / scale - position.x / scale) / PIXEL_SIZE);
        const gridY = Math.floor((e.clientY / scale - position.y / scale) / PIXEL_SIZE);
        
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            handlePixelPlace(gridX, gridY);
        }
    }, [disabled, scale, position, PIXEL_SIZE, GRID_SIZE, handlePixelPlace]);

    // Handle drag events
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: MouseEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }
        lastUpdateTimeRef.current = now;

        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;

        updatePosition({
            x: position.x + dx,
            y: position.y + dy,
        });

        lastPos.current = { x: e.clientX, y: e.clientY };
    }, [position, updatePosition, UPDATE_THROTTLE]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

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

    // Set up event listeners
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Draw grid boundary
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.rect(0, 0, GRID_SIZE * PIXEL_SIZE, GRID_SIZE * PIXEL_SIZE);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('click', handleClick);

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('click', handleClick);
        };
    }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleClick, GRID_SIZE, PIXEL_SIZE]);

    // Set cursor style
    useEffect(() => {
        if (selectedColor !== null) {
            document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="8" width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}" stroke="black" stroke-width="1"/></svg>') 16 8, auto`;
        } else {
            document.body.style.cursor = 'default';
        }
    }, [selectedColor]);

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
                <canvas
                    ref={canvasRef}
                    width={GRID_SIZE * PIXEL_SIZE}
                    height={GRID_SIZE * PIXEL_SIZE}
                    style={{
                        position: 'absolute',
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        imageRendering: 'pixelated'
                    }}
                />
                <ZoomControls
                    scale={scale}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onReset={handleReset}
                />
                <MiniMap
                    viewportBounds={viewportBounds}
                    onViewportChange={handleMiniMapViewportChange}
                />
            </div>
        </>
    );
};
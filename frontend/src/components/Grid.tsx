import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { COLOR_HEX_MAP } from '../constants/colors';
import { ZoomControls } from './ZoomControls';
import { MiniMap } from './MiniMap';
import { Snackbar, Alert } from '@mui/material';

const GRID_SIZE = 100;
const PIXEL_SIZE = 16;
const STAGE_SIZE = 800;
const MIN_SCALE = 0.5;
const MAX_SCALE = 20;
const UPDATE_THROTTLE = 100; // ms

interface GridProps {
    grid: number[][];
    selectedColor: number;
    disabled?: boolean;
    onPixelPlace: (data: { x: number; y: number; color: number }) => void;
}

export const Grid: React.FC<GridProps> = ({ grid, selectedColor, disabled = false, onPixelPlace }) => {
    const [scale, setScale] = useState(5);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const lastUpdateTimeRef = useRef(Date.now());
    const gridRef = useRef(grid);
    const [countdown, setCountdown] = useState(0);

    // Update grid ref when grid prop changes
    useEffect(() => {
        gridRef.current = grid;
    }, [grid]);

    useEffect(() => {
        if (!disabled) {
            setCountdown(0);
            return;
        }

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 0.1;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [disabled]);

    // Update countdown when disabled changes
    useEffect(() => {
        if (disabled) {
            setCountdown(3); // 3 seconds countdown
        }
    }, [disabled]);

    // Draw grid function
    const drawGrid = useCallback(() => {
        if (!layerRef.current) return;

        const layer = layerRef.current;
        layer.destroyChildren();

        // Calculate visible area
        const viewportWidth = STAGE_SIZE / scale;
        const viewportHeight = STAGE_SIZE / scale;
        const startX = Math.max(0, Math.floor(-position.x / (PIXEL_SIZE * scale)));
        const startY = Math.max(0, Math.floor(-position.y / (PIXEL_SIZE * scale)));
        const endX = Math.min(GRID_SIZE, Math.ceil((viewportWidth - position.x) / (PIXEL_SIZE * scale)));
        const endY = Math.min(GRID_SIZE, Math.ceil((viewportHeight - position.y) / (PIXEL_SIZE * scale)));

        // Draw pixels
        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const color = grid[x][y];
                const rect = new Konva.Rect({
                    x: x * PIXEL_SIZE * scale + position.x,
                    y: y * PIXEL_SIZE * scale + position.y,
                    width: PIXEL_SIZE * scale,
                    height: PIXEL_SIZE * scale,
                    fill: COLOR_HEX_MAP[color],
                    stroke: '#e5e5e5',
                    strokeWidth: 0.5,
                });
                layer.add(rect);
            }
        }

        // Draw grid lines
        const gridLines = new Konva.Group();
        
        // Vertical lines
        for (let x = startX; x <= endX; x++) {
            gridLines.add(new Konva.Line({
                points: [
                    x * PIXEL_SIZE * scale + position.x,
                    startY * PIXEL_SIZE * scale + position.y,
                    x * PIXEL_SIZE * scale + position.x,
                    endY * PIXEL_SIZE * scale + position.y
                ],
                stroke: '#e5e5e5',
                strokeWidth: 0.5,
            }));
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y++) {
            gridLines.add(new Konva.Line({
                points: [
                    startX * PIXEL_SIZE * scale + position.x,
                    y * PIXEL_SIZE * scale + position.y,
                    endX * PIXEL_SIZE * scale + position.x,
                    y * PIXEL_SIZE * scale + position.y
                ],
                stroke: '#e5e5e5',
                strokeWidth: 0.5,
            }));
        }

        layer.add(gridLines);

        // Draw hover preview
        if (mousePos && !disabled) {
            const preview = new Konva.Rect({
                x: mousePos.x,
                y: mousePos.y,
                width: PIXEL_SIZE * scale,
                height: PIXEL_SIZE * scale,
                fill: COLOR_HEX_MAP[selectedColor],
                stroke: 'black',
                strokeWidth: 1,
                opacity: 0.5,
            });
            layer.add(preview);
        }

        layer.batchDraw();
    }, [grid, position, scale, mousePos, selectedColor, disabled]);

    // Redraw grid when necessary
    useEffect(() => {
        drawGrid();
    }, [drawGrid]);

    // Throttled wheel handler
    const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        
        const oldScale = scale;
        const pointer = stageRef.current?.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - position.x) / oldScale,
            y: (pointer.y - position.y) / oldScale,
        };

        const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
        const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        
        setPosition({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        });
        setScale(clampedScale);
    }, [scale, position]);

    // Throttled click handler
    const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (disabled || !stageRef.current) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) return;
        lastUpdateTimeRef.current = now;

        const pointer = stageRef.current.getPointerPosition();
        if (!pointer) return;

        const x = Math.floor((pointer.x - position.x) / (PIXEL_SIZE * scale));
        const y = Math.floor((pointer.y - position.y) / (PIXEL_SIZE * scale));

        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            onPixelPlace({ x, y, color: selectedColor });
        }
    }, [disabled, position, scale, selectedColor, onPixelPlace]);

    // Throttled drag end handler
    const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        if (!stageRef.current) return;
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

    // Handle mouse move for color preview
    const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!stageRef.current) return;
        
        const pointer = stageRef.current.getPointerPosition();
        if (!pointer) return;

        const stagePos = stageRef.current.position();
        const x = Math.floor((pointer.x - position.x) / (PIXEL_SIZE * scale));
        const y = Math.floor((pointer.y - position.y) / (PIXEL_SIZE * scale));
        
        setMousePos({ x, y });
    }, [position, scale]);

    return (
        <div className="overflow-hidden w-full h-screen flex items-center justify-center relative bg-white">
            <Snackbar 
                open={disabled}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="info" variant="filled">
                    Wait {Math.ceil(countdown)}s before placing next pixel
                </Alert>
            </Snackbar>
            <div className="border border-gray-200 rounded">
                <Stage
                    ref={stageRef}
                    width={STAGE_SIZE}
                    height={STAGE_SIZE}
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onClick={handleClick}
                    draggable
                    onDragEnd={handleDragEnd}
                    x={position.x}
                    y={position.y}
                    scale={{ x: scale, y: scale }}
                    className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    style={{
                        cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="${COLOR_HEX_MAP[selectedColor].replace('#', '%23')}" stroke="black" stroke-width="1"/></svg>') 8 8, auto`,
                        background: 'white'
                    }}
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
        </div>
    );
}; 
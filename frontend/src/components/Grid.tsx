import { useState, useEffect, useCallback, useRef } from 'react';
import { Pixel } from '../types';
import { COLOR_HEX_MAP } from '../constants/colors';

interface GridProps {
    grid: number[][];
    selectedColor: number;
    onPixelPlace: (pixel: Pixel) => void;
    disabled: boolean;
}

export const Grid: React.FC<GridProps> = ({ grid, selectedColor, onPixelPlace, disabled }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(5); // Each pixel is 5x5 pixels on screen
    
    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw pixels
        grid.forEach((row, y) => {
            row.forEach((colorCode, x) => {
                ctx.fillStyle = COLOR_HEX_MAP[colorCode];
                ctx.fillRect(x * scale, y * scale, scale, scale);
            });
        });

        // Draw grid lines
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= canvas.width; x += scale) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= canvas.height; y += scale) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }, [grid, scale]);

    useEffect(() => {
        drawGrid();
    }, [drawGrid]);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / scale);
        const y = Math.floor((event.clientY - rect.top) / scale);

        if (x >= 0 && x < 100 && y >= 0 && y < 100) {
            onPixelPlace({ x, y, color: selectedColor });
        }
    };

    return (
        <div className="overflow-auto flex items-center justify-center min-h-screen pb-20">
            <canvas
                ref={canvasRef}
                width={100 * scale}
                height={100 * scale}
                onClick={handleCanvasClick}
                className={`border border-gray-300 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            />
        </div>
    );
}; 
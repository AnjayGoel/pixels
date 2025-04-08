import { useState, useEffect, useCallback } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Grid } from './components/Grid'
import { ColorPicker } from './components/ColorPicker'
import { COLORS } from './constants/colors'
import { Pixel, WebSocketUpdate } from './types'

function App() {
  const [grid, setGrid] = useState<number[][]>(() => 
    Array(100).fill(null).map(() => Array(100).fill(COLORS.WHITE))
  )
  const [selectedColor, setSelectedColor] = useState<number>(COLORS.BLACK)
  const [lastPlacedTime, setLastPlacedTime] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  // Mock WebSocket updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random pixel updates
      const x = Math.floor(Math.random() * 100)
      const y = Math.floor(Math.random() * 100)
      const color = Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)]
      
      handleWebSocketMessage({
        type: 'PIXEL_UPDATE',
        data: { x, y, color }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!lastPlacedTime) return

    const interval = setInterval(() => {
      const timeLeft = Math.max(0, 10 - (Date.now() - lastPlacedTime) / 1000)
      setCountdown(Math.ceil(timeLeft))

      if (timeLeft === 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [lastPlacedTime])

  const handleWebSocketMessage = (message: WebSocketUpdate) => {
    if (message.type === 'PIXEL_UPDATE') {
      const pixel = message.data as Pixel;
      setGrid(prevGrid => {
        const newGrid = [...prevGrid];
        newGrid[pixel.y] = [...newGrid[pixel.y]];
        newGrid[pixel.y][pixel.x] = pixel.color;
        return newGrid;
      });
    } else if (message.type === 'GRID_REFRESH') {
      setGrid(message.data as number[][]);
    }
  };

  const handlePixelPlace = (pixel: Pixel) => {
    if (lastPlacedTime && Date.now() - lastPlacedTime < 10000) {
      return
    }

    setLastPlacedTime(Date.now())
    // In a real implementation, this would send the update to the WebSocket server
    handleWebSocketMessage({
      type: 'PIXEL_UPDATE',
      data: pixel
    })
  }

  const isDisabled = !!(lastPlacedTime && Date.now() - lastPlacedTime < 10000)

  return (
    <div className="min-h-screen bg-gray-100">
      {countdown > 0 && (
        <div className="fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg">
          Wait {countdown}s
        </div>
      )}
      <Grid
        grid={grid}
        selectedColor={selectedColor}
        onPixelPlace={handlePixelPlace}
        disabled={isDisabled}
      />
      <ColorPicker
        selectedColor={selectedColor}
        onColorSelect={setSelectedColor}
      />
    </div>
  )
}

export default App

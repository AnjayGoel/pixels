import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './App.css'
import { Grid } from './components/Grid'
import { ColorPicker } from './components/ColorPicker'
import { COLORS } from './constants/colors'
import { Pixel, WebSocketUpdate, BatchUpdate } from './types'
import { Snackbar, Alert } from '@mui/material'

function App() {
  // Initialize the grid with proper typing
  const initialGrid = Array(100).fill(null).map(() => Array(100).fill(COLORS.WHITE))
  const gridRef = useRef<number[][]>(initialGrid)
  
  // Use state only for triggering re-renders
  const [gridVersion, setGridVersion] = useState(0)
  const [selectedColor, setSelectedColor] = useState<number | null>(COLORS.BLACK)
  const [lastPlacedTime, setLastPlacedTime] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isDisabled, setIsDisabled] = useState(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const UPDATE_THROTTLE = 8 // Increase to ~120fps

  // Memoize the grid to prevent unnecessary re-renders
  const memoizedGrid = useMemo(() => gridRef.current, [gridVersion])

  // Update disabled state
  useEffect(() => {
    if (!lastPlacedTime) {
      setIsDisabled(false)
      return
    }

    const interval = setInterval(() => {
      const timeLeft = Math.max(0, 3 - (Date.now() - lastPlacedTime) / 1000)
      setIsDisabled(timeLeft > 0)
    }, 100)

    return () => clearInterval(interval)
  }, [lastPlacedTime])

  // Mock WebSocket updates
  useEffect(() => {
    // Regular single pixel updates
    const pixelInterval = setInterval(() => {
      // Simulate random pixel updates
      const x = Math.floor(Math.random() * 100)
      const y = Math.floor(Math.random() * 100)
      const color = Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)]
      
      handleWebSocketMessage({
        type: 'PIXEL_UPDATE',
        data: { x, y, color }
      })
    }, 2000) // Increased from 500ms to 2000ms

    // Batch updates every 5 seconds
    const batchInterval = setInterval(() => {
      // Create a random size grid (between 5x5 and 15x15)
      const size = Math.floor(Math.random() * 11) + 5 // Reduced from 10x10-30x30 to 5x5-15x15
      const startX = Math.floor(Math.random() * (100 - size))
      const startY = Math.floor(Math.random() * (100 - size))
      
      // Create a random pattern for the batch update
      const batchGrid = Array(size).fill(null).map(() => 
        Array(size).fill(null).map(() => {
          // Random colors with lower probability of colored pixels
          if (Math.random() > 0.7) { // Changed from 0.3 to 0.7 (30% chance instead of 70%)
            return Object.values(COLORS)[Math.floor(Math.random() * Object.values(COLORS).length)]
          } else {
            return COLORS.WHITE // Use WHITE as transparent
          }
        })
      )
      
      // Create the batch update message
      const batchUpdateMessage: WebSocketUpdate = {
        type: 'BATCH_UPDATE',
        data: { startX, startY, grid: batchGrid }
      }
      
      // Send the message
      handleWebSocketMessage(batchUpdateMessage)
    }, 5000) // Increased from 3000ms to 5000ms

    return () => {
      clearInterval(pixelInterval)
      clearInterval(batchInterval)
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!lastPlacedTime) return

    const interval = setInterval(() => {
      const timeLeft = Math.max(0, 3 - (Date.now() - lastPlacedTime) / 1000)
      setCountdown(Math.ceil(timeLeft))

      if (timeLeft === 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [lastPlacedTime])

  const handleWebSocketMessage = useCallback((message: WebSocketUpdate) => {
    const now = Date.now()
    
    // Only throttle non-batch updates
    if (message.type !== 'BATCH_UPDATE' && now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
      return
    }
    
    // Update the last update time for all messages
    lastUpdateTimeRef.current = now
    
    if (message.type === 'PIXEL_UPDATE') {
      const pixel = message.data as Pixel
      
      // Update the grid immediately
      gridRef.current[pixel.y][pixel.x] = pixel.color
      
      // Trigger a re-render
      setGridVersion(prev => prev + 1)
      
      // Force a re-render after a short delay to ensure the update is visible
      setTimeout(() => {
        setGridVersion(prev => prev + 1)
      }, 10)
    } else if (message.type === 'GRID_REFRESH') {
      gridRef.current = message.data as number[][]
      setGridVersion(prev => prev + 1)
    } else if (message.type === 'BATCH_UPDATE') {
      const batchUpdate = message.data as BatchUpdate
      const { startX, startY, grid } = batchUpdate
      
      // Create a new grid to ensure React detects the change
      const newGrid = [...gridRef.current.map(row => [...row])]
      
      // Update the grid with the batch update
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          const targetY = startY + y
          const targetX = startX + x
          
          // Only update if within grid bounds and not transparent (WHITE)
          if (targetY >= 0 && targetY < newGrid.length && 
              targetX >= 0 && targetX < newGrid[0].length &&
              grid[y][x] !== COLORS.WHITE) { // Skip transparent pixels
            newGrid[targetY][targetX] = grid[y][x]
          }
        }
      }
      
      // Update the grid reference with the new grid
      gridRef.current = newGrid
      
      // Force multiple re-renders to ensure the update is visible
      setGridVersion(prev => prev + 1)
      
      // Force additional re-renders with increasing delays
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          setGridVersion(prev => prev + 1)
        }, i * 100)
      }
    }
  }, [])

  const handlePixelPlace = useCallback((pixel: Pixel) => {
    if (lastPlacedTime && Date.now() - lastPlacedTime < 3000) {
      return
    }

    setLastPlacedTime(Date.now())
    handleWebSocketMessage({
      type: 'PIXEL_UPDATE',
      data: pixel
    })
  }, [lastPlacedTime, handleWebSocketMessage])

  const handleColorSelect = useCallback((color: number) => {
    setSelectedColor(color)
  }, [])

  return (
    <div className="min-h-screen bg-gray-200">
      <Snackbar 
        open={countdown > 0}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled">
          Wait {countdown}s before placing next pixel
        </Alert>
      </Snackbar>
      
      <Grid
        grid={memoizedGrid}
        selectedColor={selectedColor}
        onPixelPlace={handlePixelPlace}
        disabled={isDisabled}
      />
      <ColorPicker
        selectedColor={selectedColor}
        onColorSelect={handleColorSelect}
      />
    </div>
  )
}

export default App

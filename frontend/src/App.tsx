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
  const lastRenderTimeRef = useRef<number>(0)
  const UPDATE_THROTTLE = 8 // Throttle re-renders to ~120fps
  const pendingRenderRef = useRef<boolean>(false)

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
      // Create a random size grid (between 3x3 and 10x10)
      const size = Math.floor(Math.random() * 8) + 3 // Reduced from 5x5-15x15 to 3x3-10x10
      const startX = Math.floor(Math.random() * (100 - size))
      const startY = Math.floor(Math.random() * (100 - size))
      
      // Create a random pattern for the batch update
      const batchGrid = Array(size).fill(null).map(() => 
        Array(size).fill(null).map(() => {
          // Random colors with much lower probability of colored pixels
          if (Math.random() > 0.9) { // Changed from 0.85 to 0.9 (10% chance instead of 15%)
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
    }, 8000) // Increased from 5000ms to 8000ms

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

  // Function to trigger a throttled re-render
  const triggerThrottledRender = useCallback(() => {
    const now = Date.now()
    if (now - lastRenderTimeRef.current < UPDATE_THROTTLE) {
      // If we're throttled, mark that we have a pending render
      pendingRenderRef.current = true
      return
    }
    
    // Update the last render time
    lastRenderTimeRef.current = now
    // Trigger the re-render
    setGridVersion(prev => prev + 1)
    
    // If we had a pending render, schedule another render after the throttle period
    if (pendingRenderRef.current) {
      pendingRenderRef.current = false
      setTimeout(() => {
        lastRenderTimeRef.current = 0 // Reset the last render time to allow immediate render
        triggerThrottledRender()
      }, UPDATE_THROTTLE)
    }
  }, [])

  const handleWebSocketMessage = useCallback((message: WebSocketUpdate) => {
    if (message.type === 'PIXEL_UPDATE') {
      const pixel = message.data as Pixel
      
      // Always update the grid immediately
      gridRef.current[pixel.y][pixel.x] = pixel.color
      
      // Trigger a throttled re-render
      triggerThrottledRender()
    } else if (message.type === 'GRID_REFRESH') {
      gridRef.current = message.data as number[][]
      triggerThrottledRender()
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
      
      // Trigger a throttled re-render
      triggerThrottledRender()
    }
  }, [triggerThrottledRender])

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

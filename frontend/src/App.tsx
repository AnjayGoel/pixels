import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Grid } from './components/Grid'
import { ColorPicker } from './components/ColorPicker'
import { COLORS } from './constants/colors'
import { Pixel, WebSocketUpdate } from './types'
import { Snackbar, Alert } from '@mui/material'

function App() {
  // Initialize the grid with proper typing
  const initialGrid = Array(100).fill(null).map(() => Array(100).fill(COLORS.WHITE))
  const gridRef = useRef<number[][]>(initialGrid)
  
  // Use state only for triggering re-renders
  const [gridVersion, setGridVersion] = useState(0)
  const [selectedColor, setSelectedColor] = useState<number>(COLORS.BLACK)
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
      const timeLeft = Math.max(0, 10 - (Date.now() - lastPlacedTime) / 1000)
      setIsDisabled(timeLeft > 0)
    }, 100)

    return () => clearInterval(interval)
  }, [lastPlacedTime])

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

  const handleWebSocketMessage = useCallback((message: WebSocketUpdate) => {
    const now = Date.now()
    if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
      return
    }
    lastUpdateTimeRef.current = now
    
    if (message.type === 'PIXEL_UPDATE') {
      const pixel = message.data as Pixel
      
      // Update the grid immediately
      gridRef.current[pixel.y][pixel.x] = pixel.color
      
      // Trigger a re-render
      setGridVersion(prev => prev + 1)
    } else if (message.type === 'GRID_REFRESH') {
      gridRef.current = message.data as number[][]
      setGridVersion(prev => prev + 1)
    }
  }, [])

  const handlePixelPlace = useCallback((pixel: Pixel) => {
    if (lastPlacedTime && Date.now() - lastPlacedTime < 10000) {
      return
    }

    setLastPlacedTime(Date.now())
    handleWebSocketMessage({
      type: 'PIXEL_UPDATE',
      data: pixel
    })
  }, [lastPlacedTime, handleWebSocketMessage])

  return (
    <div className="min-h-screen bg-gray-100">
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
        onColorSelect={setSelectedColor}
      />
    </div>
  )
}

export default App

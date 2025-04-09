import { useState, useCallback, useEffect } from 'react'
import './App.css'
import { Grid } from './components/Grid'
import { ColorPicker } from './components/ColorPicker'
import { COLORS } from './constants/colors'
import { Snackbar, Alert } from '@mui/material'
import { PixelStreamProvider } from './contexts/PixelStreamContext'

function App() {
  const [selectedColor, setSelectedColor] = useState<number | null>(COLORS.BLACK)
  const [countdown, setCountdown] = useState(0)

  const handleColorSelect = useCallback((color: number) => {
    setSelectedColor(color)
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [countdown])

  const handlePixelPlace = useCallback(() => {
    setCountdown(3)
  }, [])

  return (
    <PixelStreamProvider>
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
          selectedColor={selectedColor}
          onPixelPlace={handlePixelPlace}
          disabled={countdown > 0}
        />
        <ColorPicker
          selectedColor={selectedColor}
          onColorSelect={handleColorSelect}
        />
      </div>
    </PixelStreamProvider>
  )
}

export default App

import { useState, useCallback } from 'react'
import './App.css'
import { Grid } from './components/Grid'
import { ColorPicker } from './components/ColorPicker'
import { COLORS } from './constants/colors'
import { Snackbar, Alert } from '@mui/material'
import { useGrid } from './hooks/useGrid'

function App() {
  const [selectedColor, setSelectedColor] = useState<number | null>(COLORS.BLACK)
  const { grid, isDisabled, countdown, handlePixelPlace } = useGrid()

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
        grid={grid}
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

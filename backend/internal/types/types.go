package types

type Config struct {
	GridWidth     int            `json:"gridWidth"`
	GridHeight    int            `json:"gridHeight"`
	PixelCooldown int            `json:"pixelCooldown"`
	ColorMap      map[int]string `json:"colorMap"`
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{
		GridWidth:     500,
		GridHeight:    500,
		PixelCooldown: 3000,
		ColorMap: map[int]string{
			0:  "#FFFFFF", // White
			1:  "#000000", // Black
			2:  "#FF0000", // Red
			3:  "#DC143C", // Crimson
			4:  "#FF7F00", // Orange
			5:  "#FFFF00", // Yellow
			6:  "#8B4513", // Brown
			7:  "#00FF00", // Green
			8:  "#50C878", // Emerald
			9:  "#00FFFF", // Cyan
			10: "#008080", // Teal
			11: "#0000FF", // Blue
			12: "#000080", // Navy
			13: "#800080", // Purple
			14: "#FF00FF", // Pink
			15: "#BFFF00", // Lime
		},
	}
}

const (
	GRID_KEY = "pixel_grid"
)

type Pixel struct {
	X     int `json:"x"`
	Y     int `json:"y"`
	Color int `json:"color"`
}

type BatchUpdate struct {
	StartX int     `json:"startX"`
	StartY int     `json:"startY"`
	Grid   [][]int `json:"grid"`
}

type ServerUpdatePacket struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type ClientUpdatePacket struct {
	Type string `json:"type"`
	Data Pixel  `json:"data"`
}

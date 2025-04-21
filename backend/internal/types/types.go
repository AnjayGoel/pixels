package types

const (
	GRID_KEY    = "pixel_grid"
	GRID_WIDTH  = 500
	GRID_HEIGHT = 500
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

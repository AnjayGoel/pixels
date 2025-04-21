package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const (
	GRID_KEY    = "pixel_grid"
	GRID_WIDTH  = 1000 // Adjust based on your needs
	GRID_HEIGHT = 1000 // Adjust based on your needs
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	redisClient *redis.Client
)

type Pixel struct {
	X     int `json:"x"`
	Y     int `json:"y"`
	Color int `json:"color"` // Using int for color codes
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

type Grid struct {
	mu    sync.RWMutex
	grid  [][]int
	size  int
	conns map[*websocket.Conn]bool
}

func initRedis() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	redisClient = redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test Redis connection
	_, err := redisClient.Ping(context.Background()).Result()
	if err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	// Initialize grid if it doesn't exist
	exists, err := redisClient.Exists(context.Background(), GRID_KEY).Result()
	if err != nil {
		log.Fatal("Error checking grid existence:", err)
	}
	if exists == 0 {
		// Create empty grid filled with '0's
		emptyGrid := strings.Repeat("0", GRID_WIDTH*GRID_HEIGHT)
		redisClient.Set(context.Background(), GRID_KEY, emptyGrid, 0)
	}
}

func getGridIndex(x, y int) int {
	return y*GRID_WIDTH + x
}

func updatePixel(x, y, color int) error {
	index := getGridIndex(x, y)
	_, err := redisClient.SetRange(context.Background(), GRID_KEY, int64(index), strconv.Itoa(color)).Result()
	return err
}

func fetchRegion(x1, y1, x2, y2 int) (*BatchUpdate, error) {
	startIndex := getGridIndex(x1, y1)
	endIndex := getGridIndex(x2, y2)

	grid, err := redisClient.GetRange(context.Background(), GRID_KEY, int64(startIndex), int64(endIndex)).Result()
	if err != nil {
		return nil, err
	}

	width := x2 - x1 + 1
	height := y2 - y1 + 1
	gridData := make([][]int, height)
	for i := range gridData {
		gridData[i] = make([]int, width)
	}

	for i := 0; i < len(grid); i++ {
		relX := i % width
		relY := i / width
		color, _ := strconv.Atoi(string(grid[i]))
		gridData[relY][relX] = color
	}

	return &BatchUpdate{
		StartX: x1,
		StartY: y1,
		Grid:   gridData,
	}, nil
}

func NewGrid(size int) *Grid {
	grid := make([][]int, size)
	for i := range grid {
		grid[i] = make([]int, size)
	}
	return &Grid{
		grid:  grid,
		size:  size,
		conns: make(map[*websocket.Conn]bool),
	}
}

func (g *Grid) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	defer conn.Close()

	// Add connection to the list
	g.mu.Lock()
	g.conns[conn] = true
	g.mu.Unlock()

	// Send initial grid state
	initialUpdate := ServerUpdatePacket{
		Type: "BATCH_UPDATE",
		Data: BatchUpdate{
			StartX: 0,
			StartY: 0,
			Grid:   g.grid,
		},
	}
	if err := conn.WriteJSON(initialUpdate); err != nil {
		log.Println("Failed to send initial grid state:", err)
		return
	}

	// Handle incoming messages
	for {
		var packet ClientUpdatePacket
		if err := conn.ReadJSON(&packet); err != nil {
			log.Println("Failed to read message:", err)
			break
		}

		if packet.Type == "UPDATE" {
			pixel := packet.Data
			if pixel.X >= 0 && pixel.X < g.size && pixel.Y >= 0 && pixel.Y < g.size {
				g.mu.Lock()
				g.grid[pixel.Y][pixel.X] = pixel.Color
				g.mu.Unlock()

				// Broadcast the update to all connected clients
				update := ServerUpdatePacket{
					Type: "LIVE_UPDATE",
					Data: []Pixel{pixel},
				}
				g.broadcast(update)
			}
		}
	}

	// Remove connection when done
	g.mu.Lock()
	delete(g.conns, conn)
	g.mu.Unlock()
}

func (g *Grid) broadcast(update ServerUpdatePacket) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	for conn := range g.conns {
		if err := conn.WriteJSON(update); err != nil {
			log.Println("Failed to broadcast update:", err)
			conn.Close()
			delete(g.conns, conn)
		}
	}
}

func main() {
	initRedis()

	grid := NewGrid(500)

	http.HandleFunc("/ws", grid.handleWebSocket)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

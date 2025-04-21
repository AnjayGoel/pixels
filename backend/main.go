package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const (
	GRID_KEY    = "pixel_grid"
	GRID_WIDTH  = 500
	GRID_HEIGHT = 500
)

// colorToChar converts a color value (0-16) to a single character
func colorToChar(color int) byte {
	return byte('a' + color)
}

// charToColor converts a character back to a color value (0-16)
func charToColor(char byte) int {
	return int(char - 'a')
}

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

type Grid struct {
	mu    sync.RWMutex
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
		// Create empty grid filled with 'a's (color 0)
		emptyGrid := strings.Repeat("a", GRID_WIDTH*GRID_HEIGHT)
		redisClient.Set(context.Background(), GRID_KEY, emptyGrid, 0)
	}

	// Enable keyspace notifications for string operations
	redisClient.ConfigSet(context.Background(), "notify-keyspace-events", "Ks")
}

func getGridIndex(x, y int) int {
	return y*GRID_WIDTH + x
}

func updatePixel(x, y, color int) error {
	index := getGridIndex(x, y)
	char := colorToChar(color)
	_, err := redisClient.SetRange(context.Background(), GRID_KEY, int64(index), string(char)).Result()
	return err
}

func getGrid() ([][]int, error) {
	gridStr, err := redisClient.Get(context.Background(), GRID_KEY).Result()
	if err != nil {
		return nil, err
	}

	grid := make([][]int, GRID_HEIGHT)
	for y := 0; y < GRID_HEIGHT; y++ {
		grid[y] = make([]int, GRID_WIDTH)
		for x := 0; x < GRID_WIDTH; x++ {
			index := getGridIndex(x, y)
			color := charToColor(gridStr[index])
			grid[y][x] = color
		}
	}
	return grid, nil
}

func NewGrid() *Grid {
	return &Grid{
		conns: make(map[*websocket.Conn]bool),
	}
}

func (g *Grid) startKeyListener() {
	pubsub := redisClient.Subscribe(context.Background(), "__keyspace@0__:"+GRID_KEY)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		if msg.Payload == "setrange" {
			// Get the updated grid
			grid, err := getGrid()
			if err != nil {
				log.Println("Error getting grid after update:", err)
				continue
			}

			// Find the changed pixel
			// Note: This is a simplified approach. In a real implementation,
			// you might want to track the last update or use a more efficient method
			for y := 0; y < GRID_HEIGHT; y++ {
				for x := 0; x < GRID_WIDTH; x++ {
					// Broadcast the update
					update := ServerUpdatePacket{
						Type: "LIVE_UPDATE",
						Data: []Pixel{{X: x, Y: y, Color: grid[y][x]}},
					}
					g.broadcast(update)
				}
			}
		}
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
	grid, err := getGrid()
	if err != nil {
		log.Println("Failed to get grid state:", err)
		return
	}

	initialUpdate := ServerUpdatePacket{
		Type: "BATCH_UPDATE",
		Data: BatchUpdate{
			StartX: 0,
			StartY: 0,
			Grid:   grid,
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
			if pixel.X >= 0 && pixel.X < GRID_WIDTH && pixel.Y >= 0 && pixel.Y < GRID_HEIGHT {
				if err := updatePixel(pixel.X, pixel.Y, pixel.Color); err != nil {
					log.Println("Failed to update pixel:", err)
					continue
				}
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

	grid := NewGrid()

	// Start key listener in a separate goroutine
	go grid.startKeyListener()

	http.HandleFunc("/ws", grid.handleWebSocket)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

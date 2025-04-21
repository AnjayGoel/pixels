package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

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

type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
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

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	// Subscribe to Redis channel for updates
	pubsub := redisClient.Subscribe(context.Background(), "pixel_updates")
	defer pubsub.Close()

	// Channel to receive Redis messages
	ch := pubsub.Channel()

	// Handle incoming messages from client
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("Read error:", err)
				return
			}

			var wsMsg WebSocketMessage
			if err := json.Unmarshal(message, &wsMsg); err != nil {
				log.Println("JSON unmarshal error:", err)
				continue
			}

			switch wsMsg.Type {
			case "PIXEL_UPDATE":
				var pixel Pixel
				if err := json.Unmarshal(message, &pixel); err != nil {
					log.Println("Pixel unmarshal error:", err)
					continue
				}

				if err := updatePixel(pixel.X, pixel.Y, pixel.Color); err != nil {
					log.Println("Update error:", err)
					continue
				}

				// Publish update to Redis channel
				redisClient.Publish(context.Background(), "pixel_updates", message)
			}
		}
	}()

	// Forward Redis messages to WebSocket
	for msg := range ch {
		var pixel Pixel
		if err := json.Unmarshal([]byte(msg.Payload), &pixel); err != nil {
			continue
		}

		wsMsg := WebSocketMessage{
			Type: "PIXEL_UPDATE",
			Data: pixel,
		}

		message, err := json.Marshal(wsMsg)
		if err != nil {
			log.Println("Marshal error:", err)
			continue
		}

		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Println("Write error:", err)
			return
		}
	}
}

func main() {
	initRedis()

	// Add HTTP endpoints for batch operations
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/update", func(w http.ResponseWriter, r *http.Request) {
		var pixel Pixel
		if err := json.NewDecoder(r.Body).Decode(&pixel); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := updatePixel(pixel.X, pixel.Y, pixel.Color); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	http.HandleFunc("/fetch", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		x1, _ := strconv.Atoi(query.Get("x1"))
		y1, _ := strconv.Atoi(query.Get("y1"))
		x2, _ := strconv.Atoi(query.Get("x2"))
		y2, _ := strconv.Atoi(query.Get("y2"))

		batchUpdate, err := fetchRegion(x1, y1, x2, y2)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		wsMsg := WebSocketMessage{
			Type: "BATCH_UPDATE",
			Data: batchUpdate,
		}

		json.NewEncoder(w).Encode(wsMsg)
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

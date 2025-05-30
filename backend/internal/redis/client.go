package redis

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"pixels/internal/types"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const (
	CHANNEL_NAME = "pixel_updates"
)

var Client *redis.Client

var config types.Config = types.DefaultConfig()

func init() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	Client = redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test Redis connection
	_, err := Client.Ping(context.Background()).Result()
	if err != nil {
		log.Fatal("Failed to connect to Redis: ", err)
	}

	// Initialize grid if it doesn't exist
	exists, err := Client.Exists(context.Background(), types.GRID_KEY).Result()
	if err != nil {
		log.Fatal("Error checking grid existence:", err)
	}
	if exists == 0 {
		// Create empty grid filled with 'a's (color 0)
		emptyGrid := strings.Repeat("a", config.GridWidth*config.GridHeight)
		Client.Set(context.Background(), types.GRID_KEY, emptyGrid, 0)
	}
}

// colorToChar converts a color value (0-16) to a single character
func ColorToChar(color int) byte {
	return byte('a' + color)
}

// charToColor converts a character back to a color value (0-16)
func CharToColor(char byte) int {
	return int(char - 'a')
}

func GetGridIndex(x, y int) int {
	return y*config.GridWidth + x
}

func UpdatePixel(x, y, color int) error {
	index := GetGridIndex(x, y)
	char := ColorToChar(color)

	// Update the grid
	_, err := Client.SetRange(context.Background(), types.GRID_KEY, int64(index), string(char)).Result()
	if err != nil {
		return err
	}

	// Publish the update instead of adding to stream
	pixel := types.Pixel{
		X:     x,
		Y:     y,
		Color: color,
	}

	// Marshal the pixel to JSON
	messageBytes, err := json.Marshal(pixel)
	if err != nil {
		return err
	}

	return Client.Publish(context.Background(), CHANNEL_NAME, messageBytes).Err()
}

func StartPixelUpdateListener(broadcastFunc func(types.ServerUpdatePacket)) {
	pubsub := Client.Subscribe(context.Background(), CHANNEL_NAME)
	defer pubsub.Close()

	ch := pubsub.Channel()

	batch := make([]types.Pixel, 0)
	ticker := time.NewTicker(time.Millisecond * 250)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var pixel types.Pixel
			if err := json.Unmarshal([]byte(msg.Payload), &pixel); err != nil {
				log.Println("Error unmarshaling message:", err)
				continue
			}
			batch = append(batch, pixel)
		case <-ticker.C:
			if len(batch) > 0 {
				updatePacket := types.ServerUpdatePacket{
					Type: "LIVE_UPDATE",
					Data: batch,
				}
				broadcastFunc(updatePacket)
				batch = make([]types.Pixel, 0)
			}
		}
	}
}

func GetGrid() ([][]int, error) {
	gridStr, err := Client.Get(context.Background(), types.GRID_KEY).Result()
	if err != nil {
		return nil, err
	}

	grid := make([][]int, config.GridHeight)
	for y := 0; y < config.GridHeight; y++ {
		grid[y] = make([]int, config.GridWidth)
		for x := 0; x < config.GridWidth; x++ {
			index := GetGridIndex(x, y)
			color := CharToColor(gridStr[index])
			grid[y][x] = color
		}
	}
	return grid, nil
}

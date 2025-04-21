package redis

import (
	"context"
	"log"
	"os"
	"strings"

	"pixels/internal/types"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

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
		log.Fatal("Failed to connect to Redis:", err)
	}

	// Initialize grid if it doesn't exist
	exists, err := Client.Exists(context.Background(), types.GRID_KEY).Result()
	if err != nil {
		log.Fatal("Error checking grid existence:", err)
	}
	if exists == 0 {
		// Create empty grid filled with 'a's (color 0)
		emptyGrid := strings.Repeat("a", types.GRID_WIDTH*types.GRID_HEIGHT)
		Client.Set(context.Background(), types.GRID_KEY, emptyGrid, 0)
	}

	// Enable keyspace notifications for string operations
	Client.ConfigSet(context.Background(), "notify-keyspace-events", "Ks")
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
	return y*types.GRID_WIDTH + x
}

func UpdatePixel(x, y, color int) error {
	index := GetGridIndex(x, y)
	char := ColorToChar(color)
	_, err := Client.SetRange(context.Background(), types.GRID_KEY, int64(index), string(char)).Result()
	return err
}

func GetGrid() ([][]int, error) {
	gridStr, err := Client.Get(context.Background(), types.GRID_KEY).Result()
	if err != nil {
		return nil, err
	}

	grid := make([][]int, types.GRID_HEIGHT)
	for y := 0; y < types.GRID_HEIGHT; y++ {
		grid[y] = make([]int, types.GRID_WIDTH)
		for x := 0; x < types.GRID_WIDTH; x++ {
			index := GetGridIndex(x, y)
			color := CharToColor(gridStr[index])
			grid[y][x] = color
		}
	}
	return grid, nil
}

func StartKeyListener(broadcastFunc func(types.ServerUpdatePacket)) {
	pubsub := Client.Subscribe(context.Background(), "__keyspace@0__:"+types.GRID_KEY)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		if msg.Payload == "setrange" {
			// Get the updated grid
			grid, err := GetGrid()
			if err != nil {
				log.Println("Error getting grid after update:", err)
				continue
			}

			// Find the changed pixel
			// Note: This is a simplified approach. In a real implementation,
			// you might want to track the last update or use a more efficient method
			for y := 0; y < types.GRID_HEIGHT; y++ {
				for x := 0; x < types.GRID_WIDTH; x++ {
					// Broadcast the update
					update := types.ServerUpdatePacket{
						Type: "LIVE_UPDATE",
						Data: []types.Pixel{{X: x, Y: y, Color: grid[y][x]}},
					}
					broadcastFunc(update)
				}
			}
		}
	}
}

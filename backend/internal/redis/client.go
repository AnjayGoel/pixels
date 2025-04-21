package redis

import (
	"context"
	"log"
	"os"
	"strconv"
	"strings"

	"pixels/internal/types"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const (
	STREAM_KEY = "pixel_updates"
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

	// Update the grid
	_, err := Client.SetRange(context.Background(), types.GRID_KEY, int64(index), string(char)).Result()
	if err != nil {
		return err
	}

	// Add the update to the stream
	_, err = Client.XAdd(context.Background(), &redis.XAddArgs{
		Stream: STREAM_KEY,
		Values: map[string]interface{}{
			"x":     x,
			"y":     y,
			"color": color,
		},
	}).Result()
	return err
}

func StartKeyListener(broadcastFunc func(types.ServerUpdatePacket)) {
	// Start from the beginning of the stream
	lastID := "0"

	for {
		// Read new messages from the stream
		messages, err := Client.XRead(context.Background(), &redis.XReadArgs{
			Streams: []string{STREAM_KEY, lastID},
			Count:   100,
			Block:   0,
		}).Result()
		if err != nil {
			log.Println("Error reading from stream:", err)
			continue
		}

		for _, message := range messages[0].Messages {
			// Update the last ID
			lastID = message.ID

			// Extract the update data
			x, _ := strconv.Atoi(message.Values["x"].(string))
			y, _ := strconv.Atoi(message.Values["y"].(string))
			color, _ := strconv.Atoi(message.Values["color"].(string))

			// Broadcast the update
			update := types.ServerUpdatePacket{
				Type: "LIVE_UPDATE",
				Data: []types.Pixel{{X: x, Y: y, Color: color}},
			}
			broadcastFunc(update)
		}
	}
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

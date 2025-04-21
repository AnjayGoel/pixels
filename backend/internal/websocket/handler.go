package websocket

import (
	"log"
	"net/http"

	"pixels/internal/broadcast"
	"pixels/internal/redis"
	"pixels/internal/types"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func HandleWebSocket(hub *broadcast.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	defer conn.Close()

	// Add connection to the list
	hub.AddConnection(conn)
	defer hub.RemoveConnection(conn)

	// Send initial grid state
	grid, err := redis.GetGrid()
	if err != nil {
		log.Println("Failed to get grid state:", err)
		return
	}

	initialUpdate := types.ServerUpdatePacket{
		Type: "BATCH_UPDATE",
		Data: types.BatchUpdate{
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
		var packet types.ClientUpdatePacket
		if err := conn.ReadJSON(&packet); err != nil {
			log.Println("Failed to read message:", err)
			break
		}

		if packet.Type == "UPDATE" {
			pixel := packet.Data
			if pixel.X >= 0 && pixel.X < types.GRID_WIDTH && pixel.Y >= 0 && pixel.Y < types.GRID_HEIGHT {
				if err := redis.UpdatePixel(pixel.X, pixel.Y, pixel.Color); err != nil {
					log.Println("Failed to update pixel:", err)
					continue
				}
			}
		}
	}
}

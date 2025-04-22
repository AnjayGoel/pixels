package websocket

import (
	"log"
	"net/http"
	"time"

	"pixels/internal/broadcast"
	"pixels/internal/redis"
	"pixels/internal/types"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	HandshakeTimeout: 10 * time.Second,
}

func HandleWebSocket(hub *broadcast.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	conn.SetPingHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	hub.AddConnection(conn)
	defer hub.RemoveConnection(conn)

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

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	done := make(chan struct{})
	defer close(done)

	go func() {
		for {
			select {
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
					log.Printf("ping error: %v", err)
					return
				}
			case <-done:
				return
			}
		}
	}()

	for {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var packet types.ClientUpdatePacket
		if err := conn.ReadJSON(&packet); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error reading message: %v", err)
			}
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

package broadcast

import (
	"log"
	"pixels/internal/types"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu    sync.RWMutex
	conns map[*websocket.Conn]bool
}

func NewHub() *Hub {
	return &Hub{
		conns: make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) Broadcast(update types.ServerUpdatePacket) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn := range h.conns {
		go func(c *websocket.Conn) {
			c.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.WriteJSON(update); err != nil {
				log.Printf("Failed to broadcast update: %v", err)
				h.mu.Lock()
				delete(h.conns, c)
				h.mu.Unlock()
				c.Close()
			}
		}(conn)
	}
}

func (h *Hub) AddConnection(conn *websocket.Conn) {
	h.mu.Lock()
	h.conns[conn] = true
	h.mu.Unlock()
}

func (h *Hub) RemoveConnection(conn *websocket.Conn) {
	h.mu.Lock()
	delete(h.conns, conn)
	h.mu.Unlock()
}

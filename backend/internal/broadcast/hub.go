package broadcast

import (
	"log"
	"sync"

	"pixels/internal/types"

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
		if err := conn.WriteJSON(update); err != nil {
			log.Println("Failed to broadcast update:", err)
			conn.Close()
			delete(h.conns, conn)
		}
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

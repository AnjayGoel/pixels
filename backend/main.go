package main

import (
	"log"
	"net/http"

	"pixels/internal/broadcast"
	"pixels/internal/redis"
	"pixels/internal/websocket"
)

func main() {
	// Initialize Redis (this happens automatically through the init() function)
	_ = redis.Client

	// Create new hub
	hub := broadcast.NewHub()

	// Start key listener in a separate goroutine
	go redis.StartPixelUpdateListener(hub.Broadcast)

	// Set up WebSocket handler
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.HandleWebSocket(hub, w, r)
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

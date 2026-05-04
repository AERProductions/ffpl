//go:build !wails && !wailsbindings

package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("[FFPL] Starting standalone server mode")
	serverDone := make(chan struct{})
	go func() {
		startParseServer() // returns only on error (e.g. port already bound)
		close(serverDone)
	}()
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	select {
	case <-c:
	case <-serverDone:
		log.Println("[FFPL] Server exited unexpectedly — port conflict or startup error")
	}
	log.Println("[FFPL] Shutting down")
}

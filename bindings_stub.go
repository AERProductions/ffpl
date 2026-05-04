//go:build wailsbindings

package main

// bindings_stub.go — minimal main for wails binding generation.
// The real server (server_main.go) is excluded from this build tag so
// wails dev no longer spawns a zombie process that holds :8091.

func main() {}

package main

import "embed"

//go:embed data/* ffpl-hq/src/data/*
var EmbeddedData embed.FS

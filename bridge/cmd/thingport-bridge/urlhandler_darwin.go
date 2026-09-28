//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

void RunURLListener(void);
*/
import "C"

import "log"

// macOS delivers thingport:// links as Apple Events; handleGetURLEvent calls back into this.
var onOpenURLCallback func(raw string)

//export goHandleOpenURL
func goHandleOpenURL(cURL *C.char) {
	raw := C.GoString(cURL)
	if onOpenURLCallback != nil {
		onOpenURLCallback(raw)
	} else {
		log.Printf("received url before listener ready: %s", redactURL(raw))
	}
}

// Runs as a Dock-less background agent. macOS reuses this instance for later clicks.
func listenForAppleEventURLs(handle func(raw string)) {
	onOpenURLCallback = handle
	C.RunURLListener()
}

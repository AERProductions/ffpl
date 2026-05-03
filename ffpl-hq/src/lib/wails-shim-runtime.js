// Browser-safe shims for Wails runtime bindings.
// Used when VITE_TARGET=web via vite.config.js alias.

export const Quit                    = () => {};
export const WindowMinimise          = () => {};
export const WindowToggleMaximise    = () => {};
export const WindowSetAlwaysOnTop    = () => {};
export const WindowSetTitle          = () => {};
export const EventsOn                = () => () => {};   // returns unsub no-op
export const EventsOff               = () => {};
export const EventsOnce              = () => {};
export const EventsEmit              = () => {};
export const LogPrint                = () => {};
export const LogTrace                = () => {};
export const LogDebug                = () => {};
export const LogInfo                 = () => {};
export const LogWarning              = () => {};
export const LogError                = () => {};

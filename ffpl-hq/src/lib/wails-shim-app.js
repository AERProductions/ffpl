// Browser-safe shims for Wails Go bindings.
// Used when VITE_TARGET=web via vite.config.js alias.
// Desktop-only features (save parsing, matchmaker, PPSSPP windows) are no-ops
// that return a rejected promise so callers can display "Desktop app required".

const DESKTOP_ONLY = () => Promise.reject(new Error('DESKTOP_ONLY'));

export const Ping               = () => Promise.resolve('pong');
export const IsCommissioner     = () => Promise.resolve(false);
export const ProcessSaveData    = DESKTOP_ONLY;
export const AddCommissioner    = DESKTOP_ONLY;
export const TestMatchmaker     = DESKTOP_ONLY;
export const ExportColorSave    = DESKTOP_ONLY;
export const TileSpectatorWindows = DESKTOP_ONLY;
export const CaptureACPreview   = DESKTOP_ONLY;
export const ParseApolloExport  = DESKTOP_ONLY;

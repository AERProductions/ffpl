Stop-Process -Name "ffpl-dev","ffpl","node","vite" -Force -ErrorAction SilentlyContinue
Remove-Item "$PSScriptRoot\build\bin\ffpl-dev.exe" -Force -ErrorAction SilentlyContinue
wails dev -tags native_webview2loader

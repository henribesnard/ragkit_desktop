!macro NSIS_HOOK_PREINSTALL
  ; Kill ragkit-backend sidecar if still running
  nsExec::Exec 'taskkill /F /IM ragkit-backend.exe'
  ; Kill main app if still running
  nsExec::Exec 'taskkill /F /IM ragkit-desktop.exe'
  ; Brief pause to let processes release file locks
  Sleep 1000
!macroend

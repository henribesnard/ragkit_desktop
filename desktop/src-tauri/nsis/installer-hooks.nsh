!macro NSIS_HOOK_PREINSTALL
  ; Kill execution order: Main App first (Parent), then Backend (Child/Sidecar)
  
  ; Kill main app and its children
  nsExec::Exec 'cmd /c taskkill /F /IM "ragkit-desktop.exe" /T'
  
  ; Explicitly kill backend just in case it survived or was standalone
  nsExec::Exec 'cmd /c taskkill /F /IM "ragkit-backend.exe" /T'
  
  ; Wait for OS to release file locks
  Sleep 3000
!macroend

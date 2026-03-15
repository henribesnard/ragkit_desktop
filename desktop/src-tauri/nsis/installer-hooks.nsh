!macro NSIS_HOOK_PREINSTALL
  ; Kill every known process variant before overwriting files.
  ; The Tauri binary is named from Cargo.toml ("ragkit-desktop"), NOT productName.
  ; Kill the main app first with /T to take children (including the sidecar).
  nsExec::Exec 'taskkill /F /IM "ragkit-desktop.exe" /T'
  nsExec::Exec 'taskkill /F /IM "LOKO.exe" /T'

  ; Explicitly kill the backend sidecar in case it outlived the parent
  nsExec::Exec 'taskkill /F /IM "ragkit-backend.exe" /T'

  ; Wait for OS to release file locks (5s — the sidecar is ~280 MB)
  Sleep 5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /IM "ragkit-desktop.exe" /T'
  nsExec::Exec 'taskkill /F /IM "LOKO.exe" /T'
  nsExec::Exec 'taskkill /F /IM "ragkit-backend.exe" /T'
  Sleep 5000
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Ask user if they want to remove their data (bilingual)
  StrCmp $LANGUAGE 1033 0 +3
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to delete all local data and LOKO configuration (.loko folder)?" IDNO KeepData
    Goto +2
    MessageBox MB_YESNO|MB_ICONQUESTION "Voulez-vous également supprimer toutes les données locales et la configuration de LOKO (dossier .loko) ?" IDNO KeepData

  ; Delete the .loko profile folder
  RMDir /r "$PROFILE\.loko"

KeepData:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Extract the installation language chosen by the user in the NSIS dialog
  ; 1036 = French, 1033 = English
  CreateDirectory "$PROFILE\.loko"
  FileOpen $0 "$PROFILE\.loko\install_lang.txt" w
  FileWrite $0 "$LANGUAGE"
  FileClose $0
!macroend

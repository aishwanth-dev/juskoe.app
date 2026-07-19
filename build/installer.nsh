; Juskoe Custom NSIS Installer Script
; Branding polish for the installer wizard

BrandingText "Juskoe"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Juskoe Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Juskoe on your computer.$\r$\n$\r$\n\
Juskoe is a smart productivity tool that helps you work faster using your voice.$\r$\n$\r$\n\
Click Next to continue."
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Installation Complete"
  !define MUI_FINISHPAGE_TEXT "Juskoe has been installed successfully."
  ; runAfterFinish in package.json adds the MUI_FINISHPAGE_RUN checkbox
!macroend

!macro customUnInstallPage
  !define MUI_UNCONFIRMPAGE_TEXT_TOP "Are you sure you want to completely remove Juskoe and all its components?"
!macroend

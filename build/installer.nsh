; Juskoe Custom NSIS Installer Script
; Adds branding polish to the wizard flow

BrandingText "Juskoe"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Juskoe Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Juskoe on your computer.$\r$\n$\r$\n\
Juskoe is a smart productivity tool that helps you work faster using your voice.$\r$\n$\r$\n\
Click Next to continue."
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Juskoe Installation Complete"
  !define MUI_FINISHPAGE_RUN_TEXT "Launch Juskoe"
  !define MUI_FINISHPAGE_RUN
!macroend

!macro customUnInstallPage
  !define MUI_UNCONFIRMPAGE_TEXT_TOP "Are you sure you want to completely remove Juskoe and all its components?"
!macroend

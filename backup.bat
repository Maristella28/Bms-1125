@echo off
REM Simple wrapper to run the PowerShell backup script
REM This allows double-clicking to run the backup

powershell.exe -ExecutionPolicy Bypass -File "%~dp0backup.ps1" %*

pause


' Launches the dashboard PowerShell wrapper fully hidden.
' Usage: wscript.exe //nologo launcher-dashboard-hidden.vbs <mode> <port>

Option Explicit

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir, rootDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)

Dim mode, port
mode = "none"
port = "0"
If WScript.Arguments.Count >= 1 Then mode = WScript.Arguments(0)
If WScript.Arguments.Count >= 2 Then port = WScript.Arguments(1)

' Ensure stable working directory.
shell.CurrentDirectory = rootDir

Dim psExe, psArgs, cmd
psExe = """" & shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe""""
psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & rootDir & "\scripts\launcher-dashboard.ps1""" & " -Mode " & mode
If port <> "0" And port <> "" Then
  psArgs = psArgs & " -Port " & port
End If

cmd = psExe & " " & psArgs

' 0 = hide window, False = don't wait.
shell.Run cmd, 0, False

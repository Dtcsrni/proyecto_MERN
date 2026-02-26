' Launches shortcut operations PowerShell helper hidden.
' Usage: wscript.exe //nologo shortcut-op-hidden.vbs <action> <port> <mode>

Option Explicit

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim q
q = Chr(34)

Dim scriptDir, rootDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)

Dim actionName, port, mode
actionName = "open-dashboard"
port = "4519"
mode = "auto"
If WScript.Arguments.Count >= 1 Then actionName = WScript.Arguments(0)
If WScript.Arguments.Count >= 2 Then port = WScript.Arguments(1)
If WScript.Arguments.Count >= 3 Then mode = WScript.Arguments(2)

shell.CurrentDirectory = rootDir

Dim psExe, psArgs, cmd
psExe = q & shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe" & q
psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & q & rootDir & "\scripts\shortcut-ops.ps1" & q & _
         " -Action " & actionName & " -Port " & port & " -Mode " & mode
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False

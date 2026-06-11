Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c cd /d " & Chr(34) & scriptDir & Chr(34) & " && node injector.js", 0, False

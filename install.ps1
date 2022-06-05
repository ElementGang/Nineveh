iwr https://deno.land/install.ps1 -useb | iex
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") 
deno install -qAn vr https://deno.land/x/velociraptor@1.4.0/cli.ts

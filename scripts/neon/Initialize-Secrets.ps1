# Windows only, local file/ACL operations. NEVER connects to Neon or prints DSNs.
[CmdletBinding()]
param(
  [string]$SecretPath = '.secrets/neon-7b2a1/connections.json',
  [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
try {
  $path = if ([IO.Path]::IsPathRooted($SecretPath)) { [IO.Path]::GetFullPath($SecretPath) } else { [IO.Path]::GetFullPath((Join-Path (Get-Location) $SecretPath)) }
  & git check-ignore -q -- $path
  if ($LASTEXITCODE -ne 0) { throw 'Secret path must be ignored by Git.' }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $allowed = @($sid.Value,'S-1-5-18') # Current owner and SYSTEM only. Local administrators can still take ownership.
  if ($ValidateOnly) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Missing secret file.' }
    $acl = Get-Acl -LiteralPath $path
    if (-not $acl.AreAccessRulesProtected) { throw 'Inherited ACL is not accepted.' }
    foreach ($rule in $acl.Access) {
      $principal = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($rule.AccessControlType -eq 'Allow' -and $allowed -notcontains $principal) { throw 'Unexpected ACL principal.' }
    }
    $values = [IO.File]::ReadAllText($path) | ConvertFrom-Json
    $keys = @($values.PSObject.Properties.Name | Sort-Object)
    if (($keys -join ',') -ne 'adminDirect,migratorDirect,runtimeDirect,runtimePooled') { throw 'Invalid configuration keys.' }
    Write-Output 'Local file and ACL check passed. No network request; no remote authorization.'
    exit 0
  }
  if (Test-Path -LiteralPath $path) { throw 'File already exists; refusing to overwrite credentials.' }
  $directory = [IO.Path]::GetDirectoryName($path)
  if (Test-Path -LiteralPath $directory) { throw 'Use a new private directory; existing ACLs will not be replaced.' }
  [IO.Directory]::CreateDirectory($directory) | Out-Null
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner($sid)
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($principal in $allowed) {
    $identity = [Security.Principal.SecurityIdentifier]::new($principal)
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $directory -AclObject $acl
  $values = [ordered]@{}
  foreach ($name in @('adminDirect','migratorDirect','runtimeDirect','runtimePooled')) {
    $secure = Read-Host "Paste $name connection URI (hidden; local file only)" -AsSecureString
    $values[$name] = [Net.NetworkCredential]::new('',$secure).Password
    $secure.Dispose()
  }
  $json = $values | ConvertTo-Json
  # CreateNew prevents replacement of another file. Directory already has a restricted ACL.
  $stream = [IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
    $stream.Write($bytes,0,$bytes.Length)
  } finally { $stream.Dispose() }
  $fileAcl = Get-Acl -LiteralPath $path
  $fileAcl.SetAccessRuleProtection($true,$true)
  Set-Acl -LiteralPath $path -AclObject $fileAcl
  Remove-Variable json,bytes,values -ErrorAction SilentlyContinue
  Write-Output 'Secret file created locally. No network request; stage B remains blocked.'
} catch {
  # Do not print exception details or objects that could contain a pasted URI.
  Write-Error 'Local secret-file preparation failed. No remote operation was attempted.' -ErrorAction Continue
  exit 1
}

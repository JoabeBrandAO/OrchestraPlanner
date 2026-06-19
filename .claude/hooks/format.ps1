# PostToolUse hook (Mega_Build.md §7) — formata o arquivo que acabou de ser
# editado/criado, para manter a saída sempre bem formatada.
# Seguro e idempotente: só age se houver toolchain no projeto; nunca falha o tool.
$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$path = $data.tool_input.file_path
if (-not $path -or -not (Test-Path $path)) { exit 0 }

# Só formata se o projeto já tiver Node/Prettier configurado (greenfield-safe).
if (Test-Path 'package.json') {
  $ext = [System.IO.Path]::GetExtension($path).ToLower()
  if ($ext -in '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.md', '.mdx', '.html', '.yml', '.yaml') {
    npx --no-install prettier --write "$path" *> $null
  }
}

exit 0

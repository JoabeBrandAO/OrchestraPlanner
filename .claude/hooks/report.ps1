# Stop / SubagentStop hook (Mega_Build.md §7) — ao encerrar uma tarefa ou
# sub-agent, registra um checkpoint conciso e notifica o usuário.
# Append-only e idempotente; nunca falha.
param([switch]$Subagent)
$ErrorActionPreference = 'SilentlyContinue'

# git emite UTF-8; força o console a decodificar como UTF-8 para evitar mojibake.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$null = [Console]::In.ReadToEnd()

$ts     = Get-Date -Format 'yyyy-MM-dd HH:mm'
$kind   = if ($Subagent) { 'subagent-stop' } else { 'stop' }
$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
$last   = (git log -1 --oneline 2>$null)
$dirty  = (git status --porcelain 2>$null)
$state  = if ($dirty) { 'arvore suja (mudancas nao commitadas)' } else { 'arvore limpa' }

if (-not (Test-Path 'docs/RELATORIOS.md')) {
  Set-Content -Path 'docs/RELATORIOS.md' -Encoding utf8 -Value @(
    '# Relatórios de Encerramento (gerado por hook — Mega_Build §7)',
    '',
    '> Uma linha por encerramento de tarefa/sub-agent. Append-only.',
    ''
  )
}

Add-Content -Path 'docs/RELATORIOS.md' -Encoding utf8 `
  -Value "- $ts — $kind — branch ``$branch`` — $state — último: $last"

Write-Output "Checkpoint registrado em docs/RELATORIOS.md ($state)."
exit 0

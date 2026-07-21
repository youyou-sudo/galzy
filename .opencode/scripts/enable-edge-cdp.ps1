#Requires -Version 5.1
<#
.SYNOPSIS
    修改注册表使 Edge 浏览器默认启用 CDP 调试端口。

.DESCRIPTION
    通过修改 HKCR\MSEdge*\shell\open\command 注册表键，
    在 Edge 启动命令中添加 --remote-debugging-port 参数。

.PARAMETER Port
    CDP 调试端口号，默认 9222。

.PARAMETER Restore
    还原到修改前的状态（从备份恢复）。

.PARAMETER Check
    只检查当前状态，不进行任何修改。

.EXAMPLE
    .\enable-edge-cdp.ps1
    .\enable-edge-cdp.ps1 -Port 9333
    .\enable-edge-cdp.ps1 -Check
    .\enable-edge-cdp.ps1 -Restore
#>

param(
    [int]$Port = 9222,
    [switch]$Restore,
    [switch]$Check
)

# ===================== 常量 =====================
$BACKUP_VALUE_NAME = '_CDP_BACKUP_'

# ===================== 检查管理员权限 =====================
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not $Check -and -not (Test-Administrator)) {
    Write-Host '❌ 此脚本需要以管理员权限运行。' -ForegroundColor Red
    Write-Host '   请右键点击 PowerShell 选择"以管理员身份运行"，然后重新执行此脚本。' -ForegroundColor Yellow
    exit 1
}

# ===================== 获取所有 MSEdge ProgId 键 =====================
function Get-EdgeProgIdKeys {
    # 枚举 HKCR 下所有 MSEdge* 的 shell\open\command 键
    $keys = @()
    try {
        $hkcrItems = Get-ChildItem -Path 'Registry::HKEY_CLASSES_ROOT' -ErrorAction Stop |
            Where-Object { $_.PSChildName -like 'MSEdge*' }
        foreach ($item in $hkcrItems) {
            $cmdPath = Join-Path $item.PSPath 'shell\open\command'
            if (Test-Path "Registry::$($item.Name)\shell\open\command") {
                $keys += "Registry::$($item.Name)\shell\open\command"
            }
        }
    } catch {
        Write-Host "⚠️  枚举注册表键时出错: $_" -ForegroundColor Yellow
    }
    return $keys
}

# ===================== 检查 Edge 是否正在运行 =====================
function Test-EdgeRunning {
    $edgeProcs = Get-Process -Name 'msedge' -ErrorAction SilentlyContinue
    return ($null -ne $edgeProcs -and $edgeProcs.Count -gt 0)
}

# ===================== 检查模式 =====================
function Invoke-Check {
    Write-Host ''
    Write-Host '===== 检查 Edge CDP 注册表状态 =====' -ForegroundColor Cyan
    Write-Host ''

    $keys = Get-EdgeProgIdKeys
    if ($keys.Count -eq 0) {
        Write-Host '⚠️  未找到任何 MSEdge* 注册表键。' -ForegroundColor Yellow
        return
    }

    Write-Host "找到 $($keys.Count) 个 Edge ProgId 键：" -ForegroundColor Green

    foreach ($keyPath in $keys) {
        Write-Host ''
        Write-Host "  键: $keyPath" -ForegroundColor White

        try {
            $defaultVal = (Get-ItemProperty -Path $keyPath -Name '(default)' -ErrorAction Stop).'(default)'
            $backupVal  = (Get-ItemProperty -Path $keyPath -Name $BACKUP_VALUE_NAME -ErrorAction SilentlyContinue).$BACKUP_VALUE_NAME

            Write-Host "  当前命令: $defaultVal" -ForegroundColor Gray

            if ($null -ne $backupVal) {
                Write-Host "  状态: ✅ 已启用 CDP（存在备份值）" -ForegroundColor Green
                Write-Host "  备份命令: $backupVal" -ForegroundColor DarkGray
            } elseif ($defaultVal -match '--remote-debugging-port=') {
                Write-Host "  状态: ✅ 已包含 --remote-debugging-port（无备份值，可能是手动添加的）" -ForegroundColor Green
            } else {
                Write-Host "  状态: ⭕ 未启用 CDP" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ 读取键值失败: $_" -ForegroundColor Red
        }
    }
    Write-Host ''
}

# ===================== 应用模式 =====================
function Invoke-Apply {
    param([int]$DebugPort)

    Write-Host ''
    Write-Host "===== 启用 Edge CDP（端口 $DebugPort）=====" -ForegroundColor Cyan
    Write-Host ''

    # 检查 Edge 是否运行
    if (Test-EdgeRunning) {
        Write-Host '⚠️  检测到 Edge 浏览器正在运行。' -ForegroundColor Yellow
        Write-Host '   注册表修改完成后，需要完全重启 Edge 才能生效。' -ForegroundColor Yellow
        Write-Host ''
    }

    $keys = Get-EdgeProgIdKeys
    if ($keys.Count -eq 0) {
        Write-Host '⚠️  未找到任何 MSEdge* 注册表键，无需操作。' -ForegroundColor Yellow
        return
    }

    Write-Host "找到 $($keys.Count) 个 Edge ProgId 键：" -ForegroundColor Green

    $debugArg = "--remote-debugging-port=$DebugPort"
    $successCount = 0
    $skipCount = 0

    foreach ($keyPath in $keys) {
        Write-Host ''
        Write-Host "  处理: $keyPath" -ForegroundColor White

        try {
            $props = Get-ItemProperty -Path $keyPath -ErrorAction Stop
            $defaultVal = $props.'(default)'
            $backupVal  = $props.$BACKUP_VALUE_NAME

            if ($null -ne $backupVal) {
                Write-Host "  ⏭️  已有备份值，跳过（之前已启用 CDP）" -ForegroundColor Yellow
                $skipCount++
                continue
            }

            if ($defaultVal -match [regex]::Escape($debugArg)) {
                Write-Host "  ⏭️  命令已包含 $debugArg，跳过（幂等）" -ForegroundColor Yellow
                $skipCount++
                continue
            }

            # 备份原始值
            Set-ItemProperty -Path $keyPath -Name $BACKUP_VALUE_NAME -Value $defaultVal -Type String -ErrorAction Stop
            Write-Host "  💾 已备份原始值: $defaultVal" -ForegroundColor DarkGray

            # 在 msedge.exe" 后插入调试参数（保留原有参数）
            # 原始格式通常为: "C:\...\msedge.exe" --single-argument %1
            $newVal = $defaultVal -replace '(msedge\.exe")', "`$1 $debugArg"

            Set-ItemProperty -Path $keyPath -Name '(default)' -Value $newVal -Type String -ErrorAction Stop
            Write-Host "  ✅ 修改成功" -ForegroundColor Green
            Write-Host "     之前: $defaultVal" -ForegroundColor DarkGray
            Write-Host "     之后: $newVal" -ForegroundColor Gray
            $successCount++

        } catch {
            Write-Host "  ❌ 操作失败: $_" -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host "===== 完成 =====" -ForegroundColor Cyan
    Write-Host "  成功修改: $successCount 个键" -ForegroundColor Green
    Write-Host "  已跳过:   $skipCount 个键" -ForegroundColor Yellow
    if (Test-EdgeRunning) {
        Write-Host ''
        Write-Host '⚠️  请完全关闭并重启 Edge 浏览器以使修改生效。' -ForegroundColor Yellow
    }
    Write-Host ''
}

# ===================== 还原模式 =====================
function Invoke-Restore {
    Write-Host ''
    Write-Host '===== 还原 Edge 注册表（移除 CDP 配置）=====' -ForegroundColor Cyan
    Write-Host ''

    # 检查 Edge 是否运行
    if (Test-EdgeRunning) {
        Write-Host '⚠️  检测到 Edge 浏览器正在运行。' -ForegroundColor Yellow
        Write-Host '   还原完成后，需要完全重启 Edge 才能生效。' -ForegroundColor Yellow
        Write-Host ''
    }

    $keys = Get-EdgeProgIdKeys
    if ($keys.Count -eq 0) {
        Write-Host '⚠️  未找到任何 MSEdge* 注册表键，无需操作。' -ForegroundColor Yellow
        return
    }

    $successCount = 0
    $skipCount = 0

    foreach ($keyPath in $keys) {
        Write-Host ''
        Write-Host "  处理: $keyPath" -ForegroundColor White

        try {
            $props = Get-ItemProperty -Path $keyPath -ErrorAction Stop
            $backupVal = $props.$BACKUP_VALUE_NAME

            if ($null -eq $backupVal) {
                Write-Host "  ⏭️  没有备份值，跳过（可能未启用过 CDP）" -ForegroundColor Yellow
                $skipCount++
                continue
            }

            # 恢复原始值
            Set-ItemProperty -Path $keyPath -Name '(default)' -Value $backupVal -Type String -ErrorAction Stop
            Write-Host "  ✅ 已还原命令: $backupVal" -ForegroundColor Green

            # 删除备份值
            Remove-ItemProperty -Path $keyPath -Name $BACKUP_VALUE_NAME -ErrorAction Stop
            Write-Host "  🗑️  已删除备份值" -ForegroundColor DarkGray
            $successCount++

        } catch {
            Write-Host "  ❌ 操作失败: $_" -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host "===== 完成 =====" -ForegroundColor Cyan
    Write-Host "  成功还原: $successCount 个键" -ForegroundColor Green
    Write-Host "  已跳过:   $skipCount 个键" -ForegroundColor Yellow
    if (Test-EdgeRunning) {
        Write-Host ''
        Write-Host '⚠️  请完全关闭并重启 Edge 浏览器以使修改生效。' -ForegroundColor Yellow
    }
    Write-Host ''
}

# ===================== 入口 =====================
if ($Check) {
    Invoke-Check
} elseif ($Restore) {
    Invoke-Restore
} else {
    Invoke-Apply -DebugPort $Port
}

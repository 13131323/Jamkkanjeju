#requires -Version 7.0
<#
TourAPI 제주 전체 목록의 대표 사진 URL로 Redis 캐시를 미리 채운다.
장소별 사진 API나 MySQL을 호출하지 않으며 기존 Redis 값은 덮어쓰지 않는다.
#>
[CmdletBinding()]
param([switch]$DryRun, [switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$warmDryRun = $DryRun
$warmHelp = $Help
. (Join-Path $PSScriptRoot 'insert_location.ps1')

# Redis RESP의 길이는 문자 수가 아닌 UTF-8 바이트 수로 계산한다.
function ConvertTo-RedisCommand {
    param([string[]]$Arguments)
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('*').Append($Arguments.Count).Append("`r`n")
    foreach ($argument in $Arguments) {
        [void]$builder.Append('$').Append([Text.Encoding]::UTF8.GetByteCount($argument)).Append("`r`n")
        [void]$builder.Append($argument).Append("`r`n")
    }
    return $builder.ToString()
}

# 한 번의 파이프로 NX·24시간 TTL을 적용한다. 인증 정보·URL 원문은 출력하지 않는다.
function Invoke-RedisImageWarmup {
    param([string]$ProjectRoot, [object[]]$Locations)
    $startInfo = [Diagnostics.ProcessStartInfo]::new('docker')
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    foreach ($argument in @('compose', '-f', (Join-Path $ProjectRoot 'compose.yaml'), '--project-directory', $ProjectRoot,
            'exec', '-T', 'redis', 'redis-cli', '--pipe')) {
        [void]$startInfo.ArgumentList.Add($argument)
    }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        foreach ($location in $Locations) {
            $command = ConvertTo-RedisCommand @('SET', "tourapi:location-image:v1:$($location.ContentId)",
                    "URL:$($location.RepresentativeImageUrl)", 'NX', 'EX', '86400')
            $process.StandardInput.Write($command)
        }
        $process.StandardInput.Close()
        $process.WaitForExit()
        $output = $outputTask.GetAwaiter().GetResult()
        $errorOutput = $errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0 -or $output -notmatch 'errors: 0, replies:') {
            throw 'Redis 사전 적재가 실패했습니다. Redis 기동 상태를 확인하십시오. 일부 성공한 캐시는 남을 수 있으며 재실행은 안전합니다.'
        }
        Write-Host $output.Trim()
    } finally { $process.Dispose() }
}

function Invoke-LocationImageWarmup {
    if ($warmHelp) {
        Write-Host '사용: pwsh -File .\scripts\warm_location_images.ps1 [-DryRun]'
        Write-Host '제주 도메인 대상 목록을 전체 검증하고 대표 사진 URL이 있는 항목만 Redis에 24시간 저장합니다.'
        return
    }
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $config = Read-ImportConfiguration $projectRoot
    $locations = @(Get-TourApiLocations $config)
    $withImages = @($locations | Where-Object { $_.RepresentativeImageUrl })
    Write-Host "도메인 대상=$($locations.Count), 대표 사진 URL 있음=$($withImages.Count)"
    if ($warmDryRun) { Write-Host '미리보기 완료. Redis와 MySQL은 변경하지 않았습니다.'; return }
    if ($withImages.Count -eq 0) { throw '사전 적재할 사진 URL이 없습니다. Redis를 변경하지 않습니다.' }
    Invoke-RedisImageWarmup $projectRoot $withImages
    Write-Host '사진 캐시 사전 적재 완료. 기존 키는 유지했고 URL이 없는 항목은 저장하지 않았습니다. MySQL은 변경하지 않았습니다.'
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-LocationImageWarmup }
    catch { Write-Error $_.Exception.Message; exit 1 }
}

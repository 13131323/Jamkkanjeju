#requires -Version 7.0
<# 지도 홈 조회 한 종류를 1 VU로 30회 예열한 뒤 100회 측정한다. #>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Request,
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$AccessToken = $env:K6_MAP_ACCESS_TOKEN,
    [ValidateRange(-90, 90)][double]$LeftTopLatitude = 33.516564,
    [ValidateRange(-180, 180)][double]$LeftTopLongitude = 126.871019,
    [ValidateRange(-90, 90)][double]$RightBottomLatitude = 33.473436,
    [ValidateRange(-180, 180)][double]$RightBottomLongitude = 126.922981,
    [ValidateRange(-90, 90)][double]$UserLatitude = 33.495,
    [ValidateRange(-180, 180)][double]$UserLongitude = 126.897,
    [ValidatePattern('^[1-9][0-9]*(ms|s|m)$')][string]$RequestTimeout = '60s',
    [switch]$DryRun,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 설치 후 기존 터미널의 PATH가 갱신되지 않았어도 저장된 사용자·시스템 PATH에서 k6를 찾는다.
function Resolve-K6Executable {
    $command = Get-Command k6 -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) { return $command.Source }
    $savedPaths = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine')
        [Environment]::GetEnvironmentVariable('Path', 'User')
    )
    foreach ($directory in ($savedPaths -join ';') -split ';') {
        if ([string]::IsNullOrWhiteSpace($directory)) { continue }
        $expandedDirectory = [Environment]::ExpandEnvironmentVariables($directory.Trim().Trim('"'))
        $candidate = Join-Path $expandedDirectory 'k6.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    throw 'k6를 찾지 못했습니다. winget install k6 --source winget 명령으로 설치하십시오.'
}

# 입력을 검증하고 같은 URL로 두 번의 독립적인 k6 실행을 순서대로 수행한다.
function Invoke-MapLoadTest {
    if ($Help) {
        Write-Host '사용: pwsh -File .\scripts\k6\run.ps1 "GET /api/v2/map/contents" [-DryRun]'
        Write-Host '1 VU / 예열 30회 → 측정 100회 / isClustered=false 고정. 좌표·인증 옵션은 scripts/k6/README.md를 참고하십시오.'
        return
    }
    if ([string]::IsNullOrWhiteSpace($Request) -or $Request.Trim() -cnotmatch '^GET\s+/api/v2/map/contents$') {
        throw '현재 지원하는 입력은 "GET /api/v2/map/contents"뿐입니다. 좌표는 요청 옵션으로 전달하며 isClustered는 false로 고정됩니다.'
    }
    $baseUri = $null
    if (![Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$baseUri) -or
            $baseUri.Scheme -notin @('http', 'https') -or $baseUri.AbsolutePath -ne '/' -or
            $baseUri.Query -or $baseUri.Fragment -or $baseUri.UserInfo) {
        throw 'BaseUrl에는 http://localhost:8080처럼 경로·쿼리·인증 정보 없는 서버 주소를 넣으십시오.'
    }
    foreach ($coordinate in @($LeftTopLatitude, $LeftTopLongitude, $RightBottomLatitude,
            $RightBottomLongitude, $UserLatitude, $UserLongitude)) {
        if (![double]::IsFinite($coordinate)) { throw '좌표는 유한한 숫자여야 합니다.' }
    }
    if ($LeftTopLatitude -le $RightBottomLatitude -or $LeftTopLongitude -ge $RightBottomLongitude) {
        throw '좌상단 위도는 우하단보다 크고, 좌상단 경도는 우하단보다 작아야 합니다.'
    }
    $culture = [Globalization.CultureInfo]::InvariantCulture
    $query = [ordered]@{
        leftTopLatitude = $LeftTopLatitude.ToString('R', $culture)
        leftTopLongitude = $LeftTopLongitude.ToString('R', $culture)
        rightBottomLatitude = $RightBottomLatitude.ToString('R', $culture)
        rightBottomLongitude = $RightBottomLongitude.ToString('R', $culture)
        userLatitude = $UserLatitude.ToString('R', $culture)
        userLongitude = $UserLongitude.ToString('R', $culture)
        isClustered = 'false'
    }
    $queryText = ($query.GetEnumerator() | ForEach-Object {
        $_.Key + '=' + [Uri]::EscapeDataString([string]$_.Value)
    }) -join '&'
    $url = $BaseUrl.TrimEnd('/') + '/api/v2/map/contents?' + $queryText
    Write-Host "대상: GET $url"
    Write-Host '실행: 1 VU / 예열 30회 → 본 측정 100회 / 요청 사이 대기·자동 재시도·리다이렉트 없음'
    if ([string]::IsNullOrWhiteSpace($AccessToken)) {
        Write-Host '인증: 토큰 없음 — 서버의 개발용 자동 로그인과 해당 사용자 데이터가 준비되어 있어야 합니다.'
    } else { Write-Host '인증: Bearer 토큰 사용 (토큰은 출력하지 않습니다.)' }
    if ($DryRun) { Write-Host '미리보기 완료: API와 k6를 실행하지 않았습니다.'; return }

    $k6Path = Resolve-K6Executable
    foreach ($phase in @(@{ Name = '예열'; Count = 30 }, @{ Name = '본 측정'; Count = 100 })) {
        Write-Host "`n=== $($phase.Name): $($phase.Count)회 ==="
        $startInfo = [Diagnostics.ProcessStartInfo]::new($k6Path)
        $startInfo.UseShellExecute = $false
        # 출력은 캡처하지 않고 k6 기본 지표를 터미널에 바로 표시한다.
        foreach ($argument in @('run', '--summary-mode=full', '--include-system-env-vars=true',
                (Join-Path $PSScriptRoot 'map-home.js'))) {
            [void]$startInfo.ArgumentList.Add($argument)
        }
        # 토큰을 명령행 인수에 넣거나 현재 PowerShell 환경변수를 변경하지 않는다.
        $startInfo.Environment['K6_MAP_URL'] = $url
        $startInfo.Environment['K6_MAP_ACCESS_TOKEN'] = [string]$AccessToken
        $startInfo.Environment['K6_MAP_ITERATIONS'] = [string]$phase.Count
        $startInfo.Environment['K6_MAP_REQUEST_TIMEOUT'] = $RequestTimeout
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $startInfo
        try {
            [void]$process.Start()
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) {
                throw "$($phase.Name) 실패: k6 종료 코드=$($process.ExitCode). 출력된 실패율·HTTP 상태 로그를 확인하십시오. 다음 단계는 실행하지 않습니다."
            }
        } finally { $process.Dispose() }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-MapLoadTest }
    catch { Write-Error $_.Exception.Message; exit 1 }
}

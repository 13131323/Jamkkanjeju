#requires -Version 7.0
<#
제주 TourAPI 장소를 현재 Spring 프로젝트의 로컬 Docker MySQL에 적재한다.
FastAPI scripts/insert_location.py의 수집·분류·검증·contentId 정렬·갱신 규칙을 따른다.
Spring 서버·Maven·Python 없이 PowerShell 7과 Docker Compose만 사용한다.
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LocationCategories = [ordered]@{
    EV = '축제·공연·행사'
    EX = '체험관광'
    FD = '음식'
    SH = '쇼핑'
    VE = '문화관광'
    LS = '레저스포츠'
}
$LocationRadiusMeter = 100
$RowsPerPage = 1000
$SqlBatchSize = 200
$InvariantCulture = [Globalization.CultureInfo]::InvariantCulture

# .env는 UTF-8로 읽고, 동일 이름의 프로세스 환경변수를 우선한다. 값은 로그에 출력하지 않는다.
function Read-ImportConfiguration {
    param([string]$ProjectRoot)
    $config = @{
        TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2'
        TOUR_API_MOBILE_OS = 'ETC'
        TOUR_API_MOBILE_APP = 'tour-api'
    }
    $envPath = Join-Path $ProjectRoot '.env'
    if (Test-Path -LiteralPath $envPath) {
        foreach ($rawLine in [IO.File]::ReadAllLines($envPath, [Text.Encoding]::UTF8)) {
            $line = $rawLine.Trim()
            if (!$line -or $line.StartsWith('#') -or !$line.Contains('=')) { continue }
            $parts = $line.Split('=', 2)
            $config[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
        }
    }
    foreach ($name in @('TOUR_API_BASE_URL', 'TOUR_API_SERVICE_KEY', 'TOUR_API_MOBILE_OS', 'TOUR_API_MOBILE_APP')) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($null -ne $value) { $config[$name] = $value }
    }
    if (!$config.ContainsKey('TOUR_API_SERVICE_KEY') -or [string]::IsNullOrWhiteSpace($config.TOUR_API_SERVICE_KEY)) {
        throw '.env의 TOUR_API_SERVICE_KEY에 디코딩된 원문 키를 설정하십시오.'
    }
    return $config
}

# 응답에서 누락될 수 있는 필드는 null로 읽는다.
function Get-ItemValue {
    param([Collections.IDictionary]$Item, [string]$Name)
    if ($Item.Contains($Name)) { return $Item[$Name] }
    return $null
}

# 유효한 contentId를 MySQL BIGINT 범위의 정수로 변환한다.
function ConvertTo-ContentId {
    param($Value)
    $id = 0L
    if (![long]::TryParse(([string]$Value).Trim(), [Globalization.NumberStyles]::Integer, $InvariantCulture, [ref]$id)) {
        throw 'TourAPI contentid가 유효한 BIGINT 정수가 아닙니다.'
    }
    return $id
}

# 실제 DB의 좌표 CHECK도 만족하도록 유한성과 범위를 저장 전에 확인한다.
function ConvertTo-Coordinate {
    param($Value, [string]$Name, [long]$ContentId, [double]$Minimum, [double]$Maximum)
    $number = 0.0
    if (![double]::TryParse(([string]$Value).Trim(), [Globalization.NumberStyles]::Float, $InvariantCulture, [ref]$number) -or
            ![double]::IsFinite($number) -or $number -lt $Minimum -or $number -gt $Maximum) {
        throw "TourAPI 좌표가 올바르지 않습니다: contentId=$ContentId, field=$Name"
    }
    return $number
}

# 저장 대상 한 건의 필수값·길이를 모두 검증하고 현재 LOCATION 컬럼에 맞춘다.
function ConvertTo-LocationRow {
    param([Collections.IDictionary]$Item, [string]$Category)
    $contentId = ConvertTo-ContentId (Get-ItemValue $Item 'contentid')
    $title = ([string](Get-ItemValue $Item 'title')).Trim()
    $addressParts = @(
        ([string](Get-ItemValue $Item 'addr1')).Trim()
        ([string](Get-ItemValue $Item 'addr2')).Trim()
    ) | Where-Object { ![string]::IsNullOrWhiteSpace($_) }
    $address = $addressParts -join ' '
    if (!$title -or $title.Length -gt 100) { throw "장소명이 없거나 100자를 초과합니다: contentId=$contentId" }
    if (!$address -or $address.Length -gt 255) { throw "주소가 없거나 255자를 초과합니다: contentId=$contentId" }
    return [pscustomobject]@{
        ContentId = $contentId
        Title = $title
        Address = $address
        Category = $Category
        Radius = $LocationRadiusMeter
        Longitude = ConvertTo-Coordinate (Get-ItemValue $Item 'mapx') 'mapx' $contentId -180 180
        Latitude = ConvertTo-Coordinate (Get-ItemValue $Item 'mapy') 'mapy' $contentId -90 90
    }
}

# 제주 전체를 마지막 페이지까지 조회한다. HTTP 예외에 키가 포함된 URL을 출력하지 않는다.
function Get-TourApiLocations {
    param([hashtable]$Config)
    $byContentId = [Collections.Generic.Dictionary[long, object]]::new()
    $pageNo = 1
    $fetched = 0
    $totalCount = $null
    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    try {
        do {
            $params = [ordered]@{
                serviceKey = $Config.TOUR_API_SERVICE_KEY
                MobileOS = $Config.TOUR_API_MOBILE_OS
                MobileApp = $Config.TOUR_API_MOBILE_APP
                _type = 'json'
                areaCode = '39'
                numOfRows = $RowsPerPage
                pageNo = $pageNo
            }
            $query = ($params.GetEnumerator() | ForEach-Object {
                [Uri]::EscapeDataString($_.Key) + '=' + [Uri]::EscapeDataString([string]$_.Value)
            }) -join '&'
            $uri = $Config.TOUR_API_BASE_URL.TrimEnd('/') + '/areaBasedList2?' + $query
            try { $response = $client.GetAsync($uri).GetAwaiter().GetResult() }
            catch { throw "TourAPI 통신 실패: pageNo=$pageNo (요청 URL과 인증키는 출력하지 않습니다.)" }
            try {
                if (!$response.IsSuccessStatusCode) { throw "TourAPI HTTP 오류: pageNo=$pageNo, status=$([int]$response.StatusCode)" }
                $bodyText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                try { $payload = ConvertFrom-Json -InputObject $bodyText -AsHashtable }
                catch { throw "TourAPI JSON 응답 형식 오류: pageNo=$pageNo" }
            } finally { $response.Dispose() }
            if ($payload -isnot [Collections.IDictionary]) { throw "TourAPI 응답 형식 오류: pageNo=$pageNo" }
            $envelope = Get-ItemValue $payload 'response'
            if ($envelope -isnot [Collections.IDictionary]) { throw "TourAPI response 형식 오류: pageNo=$pageNo" }
            $header = Get-ItemValue $envelope 'header'
            if ($header -isnot [Collections.IDictionary] -or (Get-ItemValue $header 'resultCode') -ne '0000') {
                # resultMsg에도 요청 정보가 들어갈 수 있으므로 원문을 출력하지 않는다.
                throw "TourAPI 처리 실패: pageNo=$pageNo (인증키·사용승인·호출 한도를 확인하십시오.)"
            }
            $body = Get-ItemValue $envelope 'body'
            if ($body -isnot [Collections.IDictionary]) { throw "TourAPI body 형식 오류: pageNo=$pageNo" }
            $pageTotal = 0
            if (![int]::TryParse([string](Get-ItemValue $body 'totalCount'), [ref]$pageTotal) -or $pageTotal -lt 0) {
                throw "TourAPI totalCount 형식 오류: pageNo=$pageNo"
            }
            $totalCount = $pageTotal
            $items = Get-ItemValue $body 'items'
            $pageItems = @()
            if ($items -is [Collections.IDictionary]) {
                $rawItems = Get-ItemValue $items 'item'
                if ($rawItems -is [Collections.IDictionary]) { $pageItems = @($rawItems) }
                elseif ($rawItems -is [array]) { $pageItems = $rawItems }
                elseif ($null -ne $rawItems -and $rawItems -ne '') { throw "TourAPI items 형식 오류: pageNo=$pageNo" }
            } elseif ($null -ne $items -and $items -ne '') { throw "TourAPI items 형식 오류: pageNo=$pageNo" }

            foreach ($item in $pageItems) {
                if ($item -isnot [Collections.IDictionary]) { continue }
                $fetched++
                $code = ([string](Get-ItemValue $item 'lclsSystm1')).Trim()
                if (!$LocationCategories.Contains($code)) { continue }
                $row = ConvertTo-LocationRow $item $LocationCategories[$code]
                if ($byContentId.ContainsKey($row.ContentId)) {
                    $before = ConvertTo-Json -InputObject $byContentId[$row.ContentId] -Compress
                    $after = ConvertTo-Json -InputObject $row -Compress
                    if ($before -cne $after) { throw "중복 contentId의 데이터가 서로 다릅니다: $($row.ContentId)" }
                }
                $byContentId[$row.ContentId] = $row
            }
            Write-Host "TourAPI page=$pageNo, 조회=$fetched/$totalCount, 저장 대상=$($byContentId.Count)"
            if ($pageItems.Count -eq 0) { break }
            $pageNo++
        } while ($fetched -lt $totalCount)
    } finally { $client.Dispose() }
    if ($fetched -ne $totalCount) { throw "TourAPI 전체 건수 불일치: total=$totalCount, fetched=$fetched" }
    if ($byContentId.Count -eq 0) { throw '저장 대상 분류에 해당하는 TourAPI 장소가 없습니다.' }
    return $byContentId.Values | Sort-Object ContentId
}

# 문자열은 UTF-8 hex 리터럴로 전달해 따옴표·역슬래시·SQL 모드와 무관하게 원문을 저장한다.
function ConvertTo-SqlText {
    param([string]$Value)
    $hex = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($Value))
    return "CONVERT(X'$hex' USING utf8mb4)"
}

# 전체 검증이 끝난 데이터만 트랜잭션으로 upsert한다. 기존 PK와 다른 테이블의 참조는 유지한다.
function New-LocationImportSql {
    param([object[]]$Locations)
    $sql = [Text.StringBuilder]::new()
    [void]$sql.AppendLine('SET NAMES utf8mb4;')
    [void]$sql.AppendLine('START TRANSACTION;')
    for ($start = 0; $start -lt $Locations.Count; $start += $SqlBatchSize) {
        $last = [Math]::Min($start + $SqlBatchSize, $Locations.Count)
        $tuples = for ($index = $start; $index -lt $last; $index++) {
            $row = $Locations[$index]
            $values = @(
                $row.ContentId.ToString($InvariantCulture)
                (ConvertTo-SqlText $row.Title)
                (ConvertTo-SqlText $row.Address)
                (ConvertTo-SqlText $row.Category)
                $row.Radius.ToString($InvariantCulture)
                $row.Latitude.ToString('R', $InvariantCulture)
                $row.Longitude.ToString('R', $InvariantCulture)
            )
            '(' + ($values -join ', ') + ')'
        }
        [void]$sql.AppendLine('INSERT INTO `location` (`content_id`, `title`, `address`, `category`, `radius`, `latitude`, `longitude`) VALUES')
        [void]$sql.AppendLine(($tuples -join ",`n"))
        [void]$sql.AppendLine(@'
ON DUPLICATE KEY UPDATE
 `title` = VALUES(`title`), `address` = VALUES(`address`), `category` = VALUES(`category`),
 `radius` = VALUES(`radius`), `latitude` = VALUES(`latitude`), `longitude` = VALUES(`longitude`);
'@)
    }
    [void]$sql.AppendLine('COMMIT;')
    $ids = ($Locations | ForEach-Object { $_.ContentId.ToString($InvariantCulture) }) -join ','
    [void]$sql.AppendLine("SELECT CONCAT('verified_count=', COUNT(*)) FROM ``location`` WHERE ``content_id`` IN ($ids);")
    [void]$sql.AppendLine("SELECT CONCAT('target_database=', DATABASE());")
    return $sql.ToString()
}

# Compose의 mysql 서비스 안에서 컨테이너 계정으로 실행한다. 외부 MYSQL_HOST는 사용하지 않는다.
function Invoke-LocalMySql {
    param([string]$ProjectRoot, [string]$Sql)
    $startInfo = [Diagnostics.ProcessStartInfo]::new('docker')
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $startInfo.StandardOutputEncoding = [Text.Encoding]::UTF8
    $startInfo.StandardErrorEncoding = [Text.Encoding]::UTF8
    foreach ($argument in @('compose', '-f', (Join-Path $ProjectRoot 'compose.yaml'), '--project-directory', $ProjectRoot,
            'exec', '-T', 'mysql', 'sh', '-c',
            'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --default-character-set=utf8mb4 --batch --skip-column-names -u"$MYSQL_USER" "$MYSQL_DATABASE"')) {
        [void]$startInfo.ArgumentList.Add($argument)
    }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($Sql)
        $process.StandardInput.Close()
        $process.WaitForExit()
        $outputText = $outputTask.GetAwaiter().GetResult()
        $errorText = $errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw "로컬 Docker MySQL 실행 실패. mysql 서비스 기동·스키마·접속 계정을 확인하십시오.`n$errorText"
        }
        return $outputText
    } finally { $process.Dispose() }
}

# 수집·검증 후 미리보기 또는 로컬 DB 적재를 수행한다. 앱 실행이나 컨테이너 생성은 하지 않는다.
function Invoke-LocationImport {
    if ($Help) {
        Write-Host '사용: pwsh -File .\scripts\insert_location.ps1 [-DryRun]'
        Write-Host '-DryRun: TourAPI 수집·검증·분류별 개수만 확인하고 DB를 변경하지 않습니다.'
        return
    }
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $config = Read-ImportConfiguration $projectRoot
    if (!$DryRun) {
        # 수집 전에 컨테이너와 LOCATION 테이블 접근 가능 여부만 확인한다.
        $target = Invoke-LocalMySql $projectRoot 'SELECT DATABASE(); SELECT 1 FROM `location` LIMIT 0;'
        Write-Host "대상: 로컬 Compose mysql 서비스 / DB=$($target.Trim())"
    }
    $locations = @(Get-TourApiLocations $config)
    foreach ($category in $LocationCategories.Values) {
        $count = @($locations | Where-Object Category -eq $category).Count
        Write-Host "${category}: ${count}건"
    }
    Write-Host "전체 저장 대상: $($locations.Count)건 / 반경: ${LocationRadiusMeter}m"
    if ($DryRun) { Write-Host '미리보기 완료: DB를 변경하지 않았습니다.'; return }
    $sql = New-LocationImportSql $locations
    $outputText = Invoke-LocalMySql $projectRoot $sql
    $verification = [regex]::Match($outputText, '(?m)^verified_count=(\d+)\r?$')
    if (!$verification.Success -or [long]$verification.Groups[1].Value -ne $locations.Count) {
        throw '저장 후 LOCATION 건수 검증이 실패했습니다. COMMIT 이후 검증이므로 DB를 확인하십시오.'
    }
    Write-Host $outputText.Trim()
    Write-Host 'LOCATION 저장 완료. 기존 장소 PK는 유지하며 원본에 없는 기존 장소는 삭제하지 않았습니다.'
}

# dot-source는 검증용 함수 로딩만 수행하고 API 호출이나 DB 적재를 자동 실행하지 않는다.
if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-LocationImport }
    catch { Write-Error $_.Exception.Message; exit 1 }
}

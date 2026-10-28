const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

function parseAdbDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached') && !line.startsWith('* daemon'))
    .map((line) => {
      const [serial, state, ...metadata] = line.split(/\s+/);
      const modelEntry = metadata.find((entry) => entry.startsWith('model:'));

      return {
        serial,
        state,
        model: modelEntry?.slice('model:'.length),
        isEmulator: serial.startsWith('emulator-'),
      };
    });
}

function deviceLabel(device) {
  return device.model ? `${device.serial} (${device.model})` : device.serial;
}

function stateError(device) {
  if (device.state === 'unauthorized') {
    return new Error(`기기 ${device.serial}에서 USB 디버깅 허용 팝업을 승인한 뒤 다시 실행하세요.`);
  }

  if (device.state === 'offline') {
    return new Error(`기기 ${device.serial}가 offline 상태입니다. USB 케이블을 다시 연결한 뒤 실행하세요.`);
  }

  return new Error(`기기 ${device.serial}의 ADB 상태가 ${device.state}입니다.`);
}

function selectPhysicalDevice(devices, requestedSerial) {
  if (requestedSerial) {
    const requested = devices.find((device) => device.serial === requestedSerial);
    if (!requested) {
      throw new Error(`요청한 기기 ${requestedSerial}를 찾지 못했습니다.`);
    }
    if (requested.isEmulator) {
      throw new Error(`요청한 ${requestedSerial}는 에뮬레이터입니다. USB로 연결된 Android 실기기를 선택하세요.`);
    }
    if (requested.state !== 'device') {
      throw stateError(requested);
    }
    return requested;
  }

  const physicalDevices = devices.filter((device) => !device.isEmulator);
  const authorizedDevices = physicalDevices.filter((device) => device.state === 'device');

  if (authorizedDevices.length === 1) {
    return authorizedDevices[0];
  }

  if (authorizedDevices.length > 1) {
    const available = authorizedDevices.map(deviceLabel).join(', ');
    throw new Error(`여러 실기기가 연결되어 있습니다: ${available}. pnpm dev:app -- --device <serial>로 하나를 선택하세요.`);
  }

  const blockedDevice = physicalDevices.find((device) => device.state === 'unauthorized') ?? physicalDevices.find((device) => device.state === 'offline');
  if (blockedDevice) {
    throw stateError(blockedDevice);
  }

  if (devices.some((device) => device.isEmulator)) {
    throw new Error('에뮬레이터만 연결되어 있습니다. USB 디버깅을 활성화한 Android 실기기를 연결하세요.');
  }

  throw new Error('연결된 Android 실기기를 찾지 못했습니다. USB 케이블과 USB 디버깅 설정을 확인하세요.');
}

const METRO_PORT = '8081';

/**
 * 실기기가 adb reverse 터널로 접속할 web 주소. URL을 코드에 박지 않고 .env에서 읽는다.
 * host/port를 따로 두지 않고 URL 하나만 받아서 파싱한다 — 세 군데(adb reverse, web dev 서버,
 * EXPO_PUBLIC_WEB_URL)가 반드시 같은 값을 써야 하는데 나눠두면 한쪽만 바뀌어 어긋나기 때문이다.
 */
function resolveDevWebUrl(env) {
  const rawUrl = env.EXPO_PUBLIC_DEV_WEB_URL;

  if (!rawUrl) {
    throw new Error(
      'EXPO_PUBLIC_DEV_WEB_URL이 없습니다. app/.env에 실기기용 주소를 설정하세요 (예: http://127.0.0.1:3000).',
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`EXPO_PUBLIC_DEV_WEB_URL이 올바른 URL이 아닙니다: ${rawUrl}`);
  }

  if (!parsed.port) {
    throw new Error(`EXPO_PUBLIC_DEV_WEB_URL에 포트가 필요합니다 (예: http://127.0.0.1:3000): ${rawUrl}`);
  }

  // 끝의 슬래시를 남기면 EXPO_PUBLIC_WEB_URL에 그대로 실려 경로 결합 시 슬래시가 겹친다
  return { url: rawUrl.replace(/\/+$/, ''), hostname: parsed.hostname, port: parsed.port };
}

/** 루프백으로 취급할 호스트 — 이 주소들은 기기 안에서 자기 자신을 가리키므로 터널이 필요하다 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * API가 개발 PC의 로컬 서버면 그 포트를, 아니면 null을 준다.
 *
 * 로컬 서버를 쓸 때는 web(WebView)과 앱 양쪽이 http://localhost:8000으로 요청하는데,
 * 기기 입장에서 localhost는 기기 자신이라 adb reverse로 뚫어줘야 개발 PC에 닿는다.
 * 배포 API(https://...)를 볼 때는 기기가 인터넷으로 직접 가므로 터널이 필요 없다.
 */
function resolveLocalApiPort(rawUrl) {
  if (!rawUrl) return null;

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
  return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
}

function buildDevelopmentCommands(
  device,
  pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  env = process.env,
) {
  const expoDeviceName = device.model ?? `Device ${device.serial}`;
  const web = resolveDevWebUrl(env);
  const apiPort = resolveLocalApiPort(env.EXPO_PUBLIC_API_URL);

  const reverseArgs = [
    ['-s', device.serial, 'reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`],
    ['-s', device.serial, 'reverse', `tcp:${web.port}`, `tcp:${web.port}`],
  ];
  // web과 같은 포트면 이미 뚫려 있다
  if (apiPort !== null && apiPort !== web.port && apiPort !== METRO_PORT) {
    reverseArgs.push(['-s', device.serial, 'reverse', `tcp:${apiPort}`, `tcp:${apiPort}`]);
  }

  return {
    reverseArgs,
    web: {
      command: pnpmCommand,
      args: ['--filter', '@tamnalog/web', 'dev', '--hostname', web.hostname, '--port', web.port],
    },
    expo: {
      command: pnpmCommand,
      args: [
        '--filter',
        '@tamnalog/app',
        'exec',
        'expo',
        'run:android',
        '--device',
        expoDeviceName,
        '--port',
        METRO_PORT,
      ],
      env: {
        EXPO_OFFLINE: '1',
        EXPO_PUBLIC_WEB_URL: web.url,
        REACT_NATIVE_PACKAGER_HOSTNAME: web.hostname,
        TAMNALOG_USB_DEVICE: '1',
      },
    },
  };
}

function buildStopCommand(pid, platform = process.platform) {
  if (platform !== 'win32') return null;

  return {
    command: 'taskkill.exe',
    args: ['/pid', String(pid), '/T', '/F'],
  };
}

function parseCliOptions(argv) {
  const args = argv.filter((arg) => arg !== '--');
  let requestedSerial;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--device') {
      throw new Error(`지원하지 않는 옵션입니다: ${args[index]}`);
    }

    requestedSerial = args[index + 1];
    if (!requestedSerial || requestedSerial.startsWith('--')) {
      throw new Error('--device 다음에 ADB 기기 시리얼을 입력하세요.');
    }
    index += 1;
  }

  return { requestedSerial };
}

function getAdbCandidates(env = process.env, platform = process.platform) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const executable = platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  const candidates = sdkRoots.map((sdkRoot) => pathApi.join(sdkRoot, 'platform-tools', executable));

  return [...new Set([...candidates, 'adb'])];
}

function findAdbExecutable() {
  for (const candidate of getAdbCandidates()) {
    const probe = spawnSync(candidate, ['version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  throw new Error('ADB를 찾지 못했습니다. Android Studio의 SDK Platform-Tools를 설치하고 ANDROID_HOME을 설정하세요.');
}

function runAdb(adb, args, captureOutput = false) {
  const result = spawnSync(adb, args, {
    encoding: 'utf8',
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = captureOutput ? result.stderr.trim() : '';
    throw new Error(`ADB 명령이 실패했습니다: adb ${args.join(' ')}${details ? `\n${details}` : ''}`);
  }

  return captureOutput ? result.stdout : '';
}

function spawnPnpm(args, options) {
  if (process.env.npm_execpath) {
    return spawn(process.execPath, [process.env.npm_execpath, ...args], options);
  }

  return spawn('pnpm', args, {
    ...options,
    shell: process.platform === 'win32',
  });
}

async function superviseDevelopmentProcesses(commands, repoRoot) {
  const children = [];
  let settled = false;

  const commonOptions = {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
  };

  return new Promise((resolve, reject) => {
    const stopChildren = () => {
      for (const child of children) {
        if (child.pid && !child.killed && child.exitCode === null) {
          const stopCommand = buildStopCommand(child.pid);
          if (stopCommand) {
            spawnSync(stopCommand.command, stopCommand.args, {
              stdio: 'ignore',
              windowsHide: true,
            });
          } else {
            child.kill('SIGTERM');
          }
        }
      }
    };

    const finish = (code) => {
      if (settled) return;
      settled = true;
      stopChildren();
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigterm);
      resolve(code);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      stopChildren();
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigterm);
      reject(error);
    };

    const handleSigint = () => finish(130);
    const handleSigterm = () => finish(143);

    process.once('SIGINT', handleSigint);
    process.once('SIGTERM', handleSigterm);

    const web = spawnPnpm(commands.web.args, commonOptions);
    children.push(web);
    web.once('error', fail);
    web.once('exit', (code, signal) => {
      if (!settled) {
        console.error(`[device] Next.js가 종료되었습니다 (${signal ?? `exit ${code ?? 1}`}).`);
        finish(code ?? 1);
      }
    });

    const expo = spawnPnpm(commands.expo.args, {
      ...commonOptions,
      env: {
        ...process.env,
        ...commands.expo.env,
      },
    });
    children.push(expo);
    expo.once('error', fail);
    expo.once('exit', (code, signal) => {
      if (!settled) {
        console.error(`[device] Expo가 종료되었습니다 (${signal ?? `exit ${code ?? 1}`}).`);
        finish(code ?? 1);
      }
    });
  });
}

async function main() {
  const { requestedSerial } = parseCliOptions(process.argv.slice(2));
  const adb = findAdbExecutable();
  const devicesOutput = runAdb(adb, ['devices', '-l'], true);
  const device = selectPhysicalDevice(parseAdbDevices(devicesOutput), requestedSerial);
  const commands = buildDevelopmentCommands(device);

  console.log(`[device] ${deviceLabel(device)} 연결을 준비합니다.`);
  for (const reverseArgs of commands.reverseArgs) {
    runAdb(adb, reverseArgs);
  }
  // 뚫은 포트를 그대로 찍는다 — 로컬 API를 볼 때만 세 번째 터널이 생긴다
  const reversePorts = commands.reverseArgs.map((args) => args.at(-1).replace('tcp:', ''));
  console.log(`[device] USB reverse: ${reversePorts.join(', ')}`);
  console.log('[device] Next.js와 Expo 개발 빌드를 시작합니다. 종료: Ctrl+C');

  const repoRoot = path.resolve(path.dirname(require.main.filename), '..', '..');
  const exitCode = await superviseDevelopmentProcesses(commands, repoRoot);
  process.exitCode = exitCode;
}

module.exports = {
  buildDevelopmentCommands,
  buildStopCommand,
  resolveDevWebUrl,
  resolveLocalApiPort,
  getAdbCandidates,
  parseAdbDevices,
  parseCliOptions,
  selectPhysicalDevice,
};

if (require.main === module) {
  // Node는 .env를 자동으로 읽지 않는다. app/.env의 EXPO_PUBLIC_DEV_WEB_URL이 필요하므로 직접 로드한다.
  // 이미 셸에서 export한 값이 있으면 그쪽이 우선이고, .env가 없어도 여기서 죽지 않는다.
  try {
    process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
  } catch {
    // .env 없음 — 값이 정말 없으면 resolveDevWebUrl이 무엇을 채워야 하는지 알려준다
  }

  main().catch((error) => {
    console.error(`[device] ${error.message}`);
    process.exitCode = 1;
  });
}

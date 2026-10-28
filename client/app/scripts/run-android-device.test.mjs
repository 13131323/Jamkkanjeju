import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const runner = require('./run-android-device.js');

const adbOutput = `List of devices attached
ce10171a2da9c22905     device product:dreamlteks model:SM_G950N device:dreamlteks transport_id:1
R3CN30ABCDE            unauthorized usb:1-2 transport_id:2
emulator-5554          device product:sdk_gphone model:sdk_gphone device:emu transport_id:3
`;

describe('Android physical-device runner', () => {
  describe('parseAdbDevices', () => {
    it('preserves serial, state, model, and emulator status from adb output', () => {
      expect(runner.parseAdbDevices(adbOutput)).toEqual([
        { serial: 'ce10171a2da9c22905', state: 'device', model: 'SM_G950N', isEmulator: false },
        { serial: 'R3CN30ABCDE', state: 'unauthorized', model: undefined, isEmulator: false },
        { serial: 'emulator-5554', state: 'device', model: 'sdk_gphone', isEmulator: true },
      ]);
    });
  });

  describe('selectPhysicalDevice', () => {
    it('automatically selects the only authorized physical device', () => {
      const devices = runner.parseAdbDevices(adbOutput);

      expect(runner.selectPhysicalDevice(devices)).toMatchObject({
        serial: 'ce10171a2da9c22905',
        model: 'SM_G950N',
      });
    });

    it('selects the requested serial when multiple physical devices are authorized', () => {
      const devices = runner.parseAdbDevices(`List of devices attached
first device model:First
second device model:Second
`);

      expect(runner.selectPhysicalDevice(devices, 'second')).toMatchObject({
        serial: 'second',
        model: 'Second',
      });
    });

    it('explains how to authorize an unauthorized physical device', () => {
      const devices = runner.parseAdbDevices(`List of devices attached
phone unauthorized usb:1-2
`);

      expect(() => runner.selectPhysicalDevice(devices)).toThrow(/USB 디버깅 허용/);
    });

    it('requires an explicit serial when multiple physical devices are authorized', () => {
      const devices = runner.parseAdbDevices(`List of devices attached
first device model:First
second device model:Second
`);

      expect(() => runner.selectPhysicalDevice(devices)).toThrow(/--device <serial>/);
    });

    it('does not silently select an emulator', () => {
      const devices = runner.parseAdbDevices(`List of devices attached
emulator-5554 device model:sdk_gphone
`);

      expect(() => runner.selectPhysicalDevice(devices)).toThrow(/실기기/);
    });
  });

  describe('buildDevelopmentCommands', () => {
    it('uses explicit device selection and USB loopback ports', () => {
      expect(
        runner.buildDevelopmentCommands({ serial: 'phone-serial', model: 'Phone_Model' }, 'pnpm', {
          EXPO_PUBLIC_DEV_WEB_URL: 'http://127.0.0.1:3000',
        }),
      ).toEqual({
        reverseArgs: [
          ['-s', 'phone-serial', 'reverse', 'tcp:8081', 'tcp:8081'],
          ['-s', 'phone-serial', 'reverse', 'tcp:3000', 'tcp:3000'],
        ],
        web: {
          command: 'pnpm',
          args: ['--filter', '@tamnalog/web', 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
        },
        expo: {
          command: 'pnpm',
          args: ['--filter', '@tamnalog/app', 'exec', 'expo', 'run:android', '--device', 'Phone_Model', '--port', '8081'],
          env: {
            EXPO_OFFLINE: '1',
            EXPO_PUBLIC_WEB_URL: 'http://127.0.0.1:3000',
            REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
            TAMNALOG_USB_DEVICE: '1',
          },
        },
      });
    });

    it('API가 로컬 서버면 그 포트도 reverse 터널을 뚫는다', () => {
      const commands = runner.buildDevelopmentCommands({ serial: 'phone-serial', model: 'Phone_Model' }, 'pnpm', {
        EXPO_PUBLIC_DEV_WEB_URL: 'http://localhost:3000',
        EXPO_PUBLIC_API_URL: 'http://localhost:8000',
      });

      expect(commands.reverseArgs).toEqual([
        ['-s', 'phone-serial', 'reverse', 'tcp:8081', 'tcp:8081'],
        ['-s', 'phone-serial', 'reverse', 'tcp:3000', 'tcp:3000'],
        ['-s', 'phone-serial', 'reverse', 'tcp:8000', 'tcp:8000'],
      ]);
    });

    it('API가 원격 주소면 reverse를 추가하지 않는다 — 기기가 인터넷으로 직접 간다', () => {
      const commands = runner.buildDevelopmentCommands({ serial: 'phone-serial', model: 'Phone_Model' }, 'pnpm', {
        EXPO_PUBLIC_DEV_WEB_URL: 'http://localhost:3000',
        EXPO_PUBLIC_API_URL: 'https://jankkan-jeju.azurewebsites.net',
      });

      expect(commands.reverseArgs).toHaveLength(2);
    });

    it('API URL이 없어도 죽지 않는다', () => {
      const commands = runner.buildDevelopmentCommands({ serial: 'phone-serial', model: 'Phone_Model' }, 'pnpm', {
        EXPO_PUBLIC_DEV_WEB_URL: 'http://localhost:3000',
      });

      expect(commands.reverseArgs).toHaveLength(2);
    });

    it('web과 API 포트가 같으면 터널을 중복해서 뚫지 않는다', () => {
      const commands = runner.buildDevelopmentCommands({ serial: 'phone-serial', model: 'Phone_Model' }, 'pnpm', {
        EXPO_PUBLIC_DEV_WEB_URL: 'http://localhost:3000',
        EXPO_PUBLIC_API_URL: 'http://localhost:3000',
      });

      expect(commands.reverseArgs).toHaveLength(2);
    });
  });

  describe('resolveLocalApiPort', () => {
    it('루프백 주소에서만 포트를 준다', () => {
      expect(runner.resolveLocalApiPort('http://localhost:8000')).toBe('8000');
      expect(runner.resolveLocalApiPort('http://127.0.0.1:8000')).toBe('8000');
    });

    it('포트가 없으면 http/https 기본 포트를 쓴다', () => {
      expect(runner.resolveLocalApiPort('http://localhost')).toBe('80');
    });

    it('원격·빈 값·깨진 URL은 null이다', () => {
      expect(runner.resolveLocalApiPort('https://jankkan-jeju.azurewebsites.net')).toBeNull();
      expect(runner.resolveLocalApiPort('http://192.168.0.10:8000')).toBeNull();
      expect(runner.resolveLocalApiPort(undefined)).toBeNull();
      expect(runner.resolveLocalApiPort('not a url')).toBeNull();
    });
  });

  describe('resolveDevWebUrl', () => {
    it('.env의 URL에서 포트와 호스트를 끌어내 세 곳이 같은 값을 쓰게 한다', () => {
      const commands = runner.buildDevelopmentCommands(
        { serial: 'phone-serial', model: 'Phone_Model' },
        'pnpm',
        { EXPO_PUBLIC_DEV_WEB_URL: 'http://192.168.0.10:4000' },
      );

      expect(commands.reverseArgs[1]).toEqual([
        '-s',
        'phone-serial',
        'reverse',
        'tcp:4000',
        'tcp:4000',
      ]);
      expect(commands.web.args).toEqual([
        '--filter',
        '@tamnalog/web',
        'dev',
        '--hostname',
        '192.168.0.10',
        '--port',
        '4000',
      ]);
      expect(commands.expo.env.EXPO_PUBLIC_WEB_URL).toBe('http://192.168.0.10:4000');
      expect(commands.expo.env.REACT_NATIVE_PACKAGER_HOSTNAME).toBe('192.168.0.10');
    });

    it('끝 슬래시를 제거해 경로 결합 시 슬래시가 겹치지 않게 한다', () => {
      expect(runner.resolveDevWebUrl({ EXPO_PUBLIC_DEV_WEB_URL: 'http://127.0.0.1:3000/' }).url).toBe(
        'http://127.0.0.1:3000',
      );
    });

    it('값이 없으면 무엇을 채워야 하는지 알려주며 실패한다', () => {
      expect(() => runner.resolveDevWebUrl({})).toThrow(/EXPO_PUBLIC_DEV_WEB_URL/);
    });

    it('포트가 없으면 adb reverse를 걸 수 없으므로 실패한다', () => {
      expect(() => runner.resolveDevWebUrl({ EXPO_PUBLIC_DEV_WEB_URL: 'http://127.0.0.1' })).toThrow(
        /포트/,
      );
    });
  });

  describe('parseCliOptions', () => {
    it('accepts a serial passed through pnpm after an argument separator', () => {
      expect(runner.parseCliOptions(['--', '--device', 'second-phone'])).toEqual({
        requestedSerial: 'second-phone',
      });
    });

    it('rejects a device option without a serial', () => {
      expect(() => runner.parseCliOptions(['--device'])).toThrow(/시리얼/);
    });
  });

  describe('getAdbCandidates', () => {
    it('supports standard Android SDK environment variables without a global adb install', () => {
      expect(
        runner.getAdbCandidates(
          { ANDROID_HOME: 'C:\\Android', ANDROID_SDK_ROOT: 'D:\\AndroidSdk' },
          'win32',
        ),
      ).toEqual(['C:\\Android\\platform-tools\\adb.exe', 'D:\\AndroidSdk\\platform-tools\\adb.exe', 'adb']);
    });
  });

  describe('buildStopCommand', () => {
    it('terminates only the spawned Windows process tree', () => {
      expect(runner.buildStopCommand(1234, 'win32')).toEqual({
        command: 'taskkill.exe',
        args: ['/pid', '1234', '/T', '/F'],
      });
    });
  });
});

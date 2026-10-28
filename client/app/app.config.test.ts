import { describe, expect, it } from 'vitest';
import { validateProductionWebUrl } from './app.config';

describe('validateProductionWebUrl', () => {
  it('does not require a URL for local development', () => {
    expect(() => validateProductionWebUrl('development', undefined)).not.toThrow();
    expect(() => validateProductionWebUrl(undefined, undefined)).not.toThrow();
  });

  it('requires a URL for production', () => {
    expect(() => validateProductionWebUrl('production', undefined)).toThrow(
      'EXPO_PUBLIC_WEB_URL',
    );
  });

  it.each([
    'not-a-url',
    'http://app.example.com',
    'https://localhost',
    'https://service.local',
    'https://127.0.0.1',
    'https://10.0.2.2',
    'https://192.168.0.10',
    'https://8.8.8.8',
    'https://[::1]',
  ])('rejects a non-public production URL: %s', (url) => {
    expect(() => validateProductionWebUrl('production', url)).toThrow('public HTTPS domain');
  });

  it('accepts a public HTTPS domain for production', () => {
    expect(() =>
      validateProductionWebUrl('production', 'https://app.example.com'),
    ).not.toThrow();
  });
});

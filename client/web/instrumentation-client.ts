import * as Sentry from '@sentry/nextjs';
import axios from 'axios';
import { traceId } from './src/shared/lib/traceId';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error instanceof Error && error.name === 'ChunkLoadError') return null;
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) return null;
    if (axios.isAxiosError(error) && !error.response && error.message === 'Network Error') return null;
    return event;
  },
});

Sentry.setTag('traceId', traceId);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

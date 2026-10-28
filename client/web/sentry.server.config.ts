import * as Sentry from '@sentry/nextjs';
import axios from 'axios';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) return null;
    return event;
  },
});

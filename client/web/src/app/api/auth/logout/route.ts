import { NextRequest } from 'next/server';
import { handleBrowserLogout } from '@shared/api/auth/server';

export async function POST(request: NextRequest) {
  return handleBrowserLogout(request);
}

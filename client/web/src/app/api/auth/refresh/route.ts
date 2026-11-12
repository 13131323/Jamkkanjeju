import type { NextRequest } from 'next/server';
import { handleBrowserAuth } from '@shared/api/auth/server';
export async function POST(request: NextRequest) {
  return handleBrowserAuth(request, 'refresh');
}

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

let cachedBuildId = null;

function getBuildId() {
  if (cachedBuildId) return cachedBuildId;
  try {
    cachedBuildId = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    cachedBuildId = process.env.VERCEL_GIT_COMMIT_SHA || '__dev__';
  }
  return cachedBuildId;
}

export function GET() {
  return NextResponse.json(
    { v: getBuildId() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

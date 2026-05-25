import { getLast10 } from '@/lib/mlb';
import { NextResponse } from 'next/server';

export async function GET() {
  const games = await getLast10();
  return NextResponse.json(games);
}
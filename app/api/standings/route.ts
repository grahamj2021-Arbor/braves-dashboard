import { getStandings } from '@/lib/mlb';
import { NextResponse } from 'next/server';

export async function GET() {
  const data = await getStandings();
  return NextResponse.json(data);
}
import { getTodaysGame } from '../../../../lib/mlb';
import { NextResponse } from 'next/server';

export async function GET() {
  const game = await getTodaysGame();
  return NextResponse.json(game);
}
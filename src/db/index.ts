import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from "@libsql/client";
import { eq, and } from "drizzle-orm";
import { playersTable, scoresTable, wordlesTable, type SelectScoreWithRelations } from './schema';
import * as schema from './schema';

const client = createClient({
  url: process.env.DB_FILE_NAME!,
});
const db = drizzle(client, { schema });

export async function getScoresByGameNumber(gameNumber: number): Promise<SelectScoreWithRelations[]> {
  try {
    return await db.query.scoresTable.findMany({
      where: eq(scoresTable.gameNumber, gameNumber), with: {
        player: true
      }
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function createWordle(gameNumber: number): Promise<boolean> {
  try {
    await db.insert(wordlesTable).values({ gameNumber }).onConflictDoNothing();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function createPlayer(discordId: string, discordName: string): Promise<boolean> {
  try {
    await db.insert(playersTable).values({ discordId, discordName }).onConflictDoNothing();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function createScore(discordId: string, gameNumber: number, attempts: string, isWin: number = 0, isTie: number = 0): Promise<SelectScoreWithRelations | undefined> {
  try {
    const result = await db.insert(scoresTable).values({ discordId, gameNumber, attempts, isWin, isTie }).onConflictDoNothing().returning();
    console.dir(result);
    if (result.length === 0) {
      return undefined;
    }
    const score = await db.query.scoresTable.findFirst({
      where: and(eq(scoresTable.gameNumber, gameNumber), eq(scoresTable.discordId, discordId)), with: {
        player: true
      }
    });
    return score;
  } catch (error) {
    console.error(error);
    return;
  }
}

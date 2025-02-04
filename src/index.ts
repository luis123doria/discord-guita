import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as db from './db';
import type { SelectScoreWithRelations } from './db/schema';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const wordlePattern = /Wordle (\d{0,3}(,?)\d{1,3}) (🎉 ?)?([X1-6])\/6/;
type WordleResult = {
  discordId: string;
  userName: string;
  gameNumber: number;
  attempts: string;
};
let wordleResults: WordleResult[] = [];

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user?.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  const parsedWordle = parseWordleResult(message);
  if (parsedWordle) {
    const currentResults = await processLatestWordleResult(parsedWordle);
    await processCurrentResults(currentResults, message);
  } else {
    console.log('Message was determined to not be intended for the bot');
  }
});

await client.login(process.env.DISCORD_BOT_TOKEN);

function parseWordleResult(message: any): WordleResult | undefined {
  const userName = message.author.username;
  const discordId = message.author.id;
  const match = wordlePattern.exec(message.content);

  if (match) {
    const gameNumber = parseInt(match[1].replace(/,/g, ''));
    const attempts = match[4];

    return {
      discordId,
      userName,
      gameNumber,
      attempts,
    };
  }

  return undefined;
}

async function processLatestWordleResult(parsedWordle: WordleResult): Promise<SelectScoreWithRelations[]> {
  // Prevent duplicates
  const scoresForCurrentGame = await db.getScoresByGameNumber(parsedWordle.gameNumber);
  const existingResultForUser = scoresForCurrentGame.find((score: SelectScoreWithRelations) => score.discordId === parsedWordle.discordId);
  if (!existingResultForUser) {
    await db.createPlayer(parsedWordle.discordId, parsedWordle.userName);
    if(scoresForCurrentGame.length === 0) {
      await db.createWordle(parsedWordle.gameNumber);
    }
    const addedScore = await db.createScore(parsedWordle.discordId, parsedWordle.gameNumber, parsedWordle.attempts);
    if(addedScore){
      scoresForCurrentGame.push(addedScore);
    } else {
      console.error(`Error adding result to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    }
  } else {
    console.log(`Result already exists: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
  }
  return scoresForCurrentGame;
}

async function processCurrentResults(currentResults: SelectScoreWithRelations[], message: any) {
  try {
    if (currentResults.length > 0) {
      const winners: SelectScoreWithRelations[] = await determineWinners(currentResults);
      if (winners.length > 0) {
        await informLatestResults(winners, message);
      }
    } else {
      console.log('No results from processing the latest Wordle result.');
    }
  } catch (error) {
    console.error('Error processing Wordle Result:', error);
  }
}

async function determineWinners(results: SelectScoreWithRelations[]): Promise<SelectScoreWithRelations[]> {
  if (!results || results.length === 0) return [];

  // Filter out failed attempts (X) before processing
  const validResults = results.filter(score => score.attempts.toUpperCase() !== 'X');

  if (validResults.length === 0) return [];

  // Convert attempts to numbers for comparison
  const resultsWithNumericAttempts = validResults.map(result => ({
    ...result,
    numericAttempts: parseInt(result.attempts)
  }));

  // Find minimum attempts
  const minAttempts = Math.min(
    ...resultsWithNumericAttempts.map(result => result.numericAttempts)
  );

  // Return all scores that match minimum attempts
  return validResults.filter((_, index) =>
    resultsWithNumericAttempts[index].numericAttempts === minAttempts
  );
}

async function informLatestResults(winners: SelectScoreWithRelations[], message: any) {
  const winnerDiscordIds = winners.map(winner => winner.discordId);
  const winnerDiscordTags = winnerDiscordIds.map(id => `<@${id}>`);

  const gameNumber = winners[0].gameNumber || 1;
  const winningAttempts = winners[0].attempts === 'X' ? 0 : parseInt(winners[0].attempts);
  const winnerTags = winnerDiscordTags.join(', ');

  const winnerMessage = `Current Winner${winners.length > 1 ? "s" : ""} for Wordle ${gameNumber.toLocaleString()} with ${winningAttempts} attempt${winningAttempts !== 0 && winningAttempts > 1 ? 's' : ''}: ${winnerTags}`;

  console.log(winnerMessage);
  await message.channel.send(winnerMessage);
}

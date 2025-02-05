// filepath: /home/luis123doria/Escritorio/Github/discord-guitaBot/discord-guita/src/commands/commands.ts
import { CommandInteraction } from 'discord.js';

export const data = {
  name: 'comandos',
  description: 'Lists all available commands'
};

export async function execute(interaction: CommandInteraction) {
  const commands = [
    'ping - Checks the bot\'s latency',
    'help - Provides help information',
    'puntos - Shows your points',
    'rank - Displays the ranking'
  ];

  await interaction.reply(`Comandos disponibles:\n${commands.join('\n')}`);
}
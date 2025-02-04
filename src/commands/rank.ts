import { SlashCommandBuilder } from "@discordjs/builders";
import type { Client, CommandInteraction, TextChannel } from "discord.js";

// Assuming userPoints is imported from the file where it's defined
import { userPoints } from './puntos';

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Muestra el ranking de puntos de todos los usuarios');

export async function execute(interaction: CommandInteraction, client: Client) {
    // Con esto te aseguras que estés escribiendo en un canal, y no en un Thread
    if (!interaction?.channelId) {
        return;
    }

    // Debug: Log the userPoints object
    console.log('userPoints:', userPoints);

    // Convert userPoints object to an array of [userId, points] pairs
    const pointsArray = Object.entries(userPoints);

    // Debug: Log the pointsArray
    console.log('pointsArray:', pointsArray);

    // Sort the array by points in descending order
    pointsArray.sort((a, b) => b[1] - a[1]);

    // Fetch user objects and format the leaderboard
    const leaderboardPromises = pointsArray.map(async ([userId, points], index) => {
        try {
            const user = await client.users.fetch(userId);
            let emoji = '';
            switch (index) {
                case 0:
                    emoji = '🥇'; // Gold medal for 1st place
                    break;
                case 1:
                    emoji = '🥈'; // Silver medal for 2nd place
                    break;
                case 2:
                    emoji = '🥉'; // Bronze medal for 3rd place
                    break;
                default:
                    emoji = '🏅'; // Medal for other places
                    break;
            }
            return `${emoji} **${index + 1}.** ${user.tag}: **${points}** puntos`;
        } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            return `${index + 1}. Usuario desconocido: ${points} puntos`;
        }
    });

    const leaderboard = await Promise.all(leaderboardPromises);

    // Debug: Log the leaderboard array
    console.log('leaderboard:', leaderboard);

    // Send the leaderboard as a reply
    return interaction.reply({
        content: `**Leaderboard de puntos:**\n${leaderboard.join('\n')}`,
        allowedMentions: { users: [] } // Prevents mentioning users
    });
}
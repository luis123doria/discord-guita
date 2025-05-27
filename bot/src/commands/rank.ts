import { SlashCommandBuilder } from "@discordjs/builders";
import type { Client, CommandInteraction, TextChannel } from "discord.js";
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Muestra el ranking de puntos de todos los usuarios');

export async function execute(interaction: CommandInteraction, client: Client) {
    // Con esto te aseguras que estés escribiendo en un canal, y no en un Thread
    if (!interaction?.channelId) {
        return;
    }

    const pointsSnapshot = await db.collection('horas_guita').orderBy('horas', 'desc').get();
    const pointsArray = pointsSnapshot.docs.map(doc => ({ 
        user_id: doc.id, 
        horas: doc.data().horas, 
        puntos: doc.data().puntos, 
    }));
    // Calcular las horas totales
    const totalHoras = pointsArray.reduce((sum, user) => sum + user.horas, 0);
    console.log('Total horas:', totalHoras);

    const leaderboardPromises = pointsArray.map(async ({ user_id, horas, puntos, porcentaje }, index) => {
        try {
            const user = await client.users.fetch(user_id);
            const porcentaje = totalHoras > 0 ? ((horas / totalHoras) * 100).toFixed(2) : "0.00";
            
            // Guardar el porcentaje en Firestore
            await db.collection('horas_guita').doc(user_id).update({
                porcentaje: parseFloat(porcentaje),
            });
            
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
            
            return `${emoji} **${index + 1}.** ${user.tag}: **${horas}** horas - **${puntos}** puntos - **${porcentaje}%** Participación`;
        } catch (error) {
            console.error(`Error fetching user ${user_id}:`, error);
            return `${index + 1}. Usuario desconocido: ${horas} horas - **${puntos}** puntos - **${porcentaje}%** Participación`;
        }
    });    

    const leaderboard = await Promise.all(leaderboardPromises);

    // Debug: Log the leaderboard array
    console.log('leaderboard:', leaderboard);

    // Send the leaderboard as a reply
    return interaction.reply({
        content: `**Los más guiteros:**\n${leaderboard.join('\n')}`,
        allowedMentions: { users: [] } // Prevents mentioning users
    });
}
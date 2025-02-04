import { SlashCommandBuilder } from "@discordjs/builders";
import type { Client, CommandInteraction, TextChannel } from "discord.js";

// Object to store points for each user
export const userPoints: { [key: string]: number } = {};

export const data = new SlashCommandBuilder()
    .setName('puntos')
    .setDescription('Añadir o restar puntos a un usuario')
    .addStringOption(option => 
        option
            .setName('usuario')
            .setDescription('Indica el usuario al que se le añadirán los puntos')
            .setRequired(true)
    )
    .addStringOption(option => 
        option
            .setName('accion')
            .setDescription('Indica si quieres añadir o restar puntos')
            .setRequired(true)
            .addChoices({ name: 'Añadir', value: 'add' },
                { name: 'Restar', value: 'subtract' }
            )
    )
    .addStringOption(option => 
        option
            .setName('puntos')
            .setDescription('Indica la cantidad de puntos a añadir')
            .setRequired(true)
    );

export async function execute(interaction: CommandInteraction, client: Client) {
    
    // Con esto te aseguras que estés escribiendo en un canal, y no en un Thread
    if(!interaction ?.channelId){
        return;
    }

    let userId = interaction.options.get('usuario')?.value as string;
    const points = parseInt(interaction.options.get('puntos')?.value as string, 10);
    const action = interaction.options.get('accion')?.value as string;

    if (isNaN(points)) {
        return interaction.reply({
            content: 'La cantidad de puntos debe ser un número válido.',
            ephemeral: true
        });
    }

    // Extract user ID from mention format if necessary
    if (userId.startsWith('<@') && userId.endsWith('>')) {
        userId = userId.slice(2, -1);
        if (userId.startsWith('!')) {
            userId = userId.slice(1);
        }
    }

    // Initialize user points if not already set
    if (!userPoints[userId]) {
        userPoints[userId] = 0;
    }

    // Add or subtract points based on the action
    if (action === 'add') {
        userPoints[userId] += points;
    } else if (action === 'subtract') {
        userPoints[userId] -= points;
    } else {
        return interaction.reply({
            content: 'Acción no válida. Debes elegir entre "Añadir" o "Restar".',
            ephemeral: true
        });
    }

    // Debug: Log the updated userPoints object
    console.log('Updated userPoints:', userPoints);

    return interaction.reply({
        content: `Se ${action === 'add' ? 'añadieron' : 'restaron'} ${points} puntos al usuario <@${userId}>. Total de puntos: ${userPoints[userId]}.`
    });
}

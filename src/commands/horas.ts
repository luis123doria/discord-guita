import { SlashCommandBuilder } from "@discordjs/builders";
import type { Client, CommandInteraction, GuildMember } from "discord.js";
import { db } from '../firebase';
import { MessageFlags } from 'discord.js';

// Object to store points for each user
// export const userPoints: { [key: string]: number } = {};

export const data = new SlashCommandBuilder()
    .setName('horas')
    .setDescription('Añadir o restar horas de guita a un usuario.')
    .addStringOption(option => 
        option
            .setName('usuario')
            .setDescription('Indica el usuario al que se le añadirán las horas.')
            .setRequired(true)
    )
    .addStringOption(option => 
        option
            .setName('accion')
            .setDescription('Indica si quieres añadir o restar horas de guita.')
            .setRequired(true)
            .addChoices(
                { name: 'Añadir', value: 'add' },
                { name: 'Restar', value: 'subtract' }
            )
    )
    .addStringOption(option => 
        option
            .setName('horas')
            .setDescription('Indica la cantidad de horas de guita')
            .setRequired(true)
    );

export async function execute(interaction: CommandInteraction, client: Client) {
    
    // Con esto te aseguras que estés escribiendo en un canal, y no en un Thread
    if(!interaction ?.channelId){
        return;
    }

    let userId = interaction.options.get('usuario')?.value as string;
    const horas = parseInt(interaction.options.get('horas')?.value as string, 10);
    const action = interaction.options.get('accion')?.value as string;

    if (isNaN(horas) || horas <= 0)  {
        return interaction.reply({
            content: 'La cantidad de horas debe ser un número válido.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Extract user ID from mention format if necessary
    if (userId.startsWith('<@') && userId.endsWith('>')) {
        userId = userId.slice(2, -1);
        if (userId.startsWith('!')) {
            userId = userId.slice(1);
        }
    }

    // Obtener el miembro del servidor
    const guild = interaction.guild;
    if (!guild) {
        return interaction.reply({
            content: 'Este comando solo puede usarse en un servidor.',
            flags: MessageFlags.Ephemeral
        });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
        return interaction.reply({
            content: 'No se pudo encontrar al usuario en este servidor.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Initialize user points if not already set
    const userRef = db.collection('horas_guita').doc(userId);
    const userDoc = await userRef.get();

    // Obtener las horas y puntos actuales del usuario
    let currentHoras = userDoc.exists ? (userDoc.data()?.horas ?? 0) : 0;
    let currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
    let currentNE = userDoc.exists ? (userDoc.data()?.NE ?? 0) : 0;
    let currentE = userDoc.exists ? (userDoc.data()?.E ?? 0) : 0;
    let currentSE = userDoc.exists ? (userDoc.data()?.SE ?? 0) : 0;
    let currentGL = userDoc.exists ? (userDoc.data()?.GL ?? 0) : 0;
    let streak = userDoc.exists ? (userDoc.data()?.streak ?? null) : null; // Propiedad para rastrear la racha actual
    let streakCount = userDoc.exists ? (userDoc.data()?.streakCount ?? 0) : 0; // Contador de la racha actual
    
    // IDs de los roles correspondientes a las rachas
    const roles = {
        NE: '1364124171348742204', // Reemplaza con el ID del rol NE
        E: '1364124414928752664',   // Reemplaza con el ID del rol E
        SE: '1364124523795976222', // Reemplaza con el ID del rol SE
        GL: '1364124630528294992'  // Reemplaza con el ID del rol GL
    } ;

    // // Tipar streak para que coincida con las keys de roles
    // type StreakType = keyof typeof roles; // 'NE' | 'E' | 'SE' | 'GL'
    // let streak: StreakType | null = null;


    // Añadir o restar horas según la acción
    if (action === 'add') {
        currentHoras += horas;
        currentPoints += horas * 50; // Assuming 1 hour = 50 points

        let streakMessage = '';
        let streakText = '';

        // Reiniciar los contadores de racha si se cambia de rango
        if (horas > 0 && horas < 6) {
            if (streak !== 'NE') {
                currentE = 0;
                currentSE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentNE += 1;
            streak = 'NE';
            streakText = 'No Efectiva';
            streakCount += 1;
        } else if (horas >= 6 && horas <= 10) {
            if (streak !== 'E') {
                currentNE = 0;
                currentSE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentE += 1;
            streak = 'E';
            streakText = 'Efectiva';
            streakCount += 1;
        } else if (horas > 10 && horas <= 12) {
            if (streak !== 'SE') {
                currentNE = 0;
                currentE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentSE += 1;
            streak = 'SE';
            streakText = 'Supel Elegante';
            streakCount += 1;
        } else if (horas > 12) {
            if (streak !== 'GL') {
                currentNE = 0;
                currentE = 0;
                currentSE = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentGL += 1;
            streak = 'GL';
            streakText = 'GuitaLover';
            streakCount += 1;
        }

        // Verificar si se ha alcanzado una racha de 3
        if (streakCount === 3) {
            streakMessage = `🟩 ¡Has entrado en una racha *${streakText}*!`;
            // Asignar el rol correspondiente
            if (roles[streak]) {
                await member.roles.add(roles[streak]).catch(() => {});
            }
        } else if (streakCount > 3) {
            streakMessage = `🥳 ¡Has mantenido tu racha *${streakText}* por ${streakCount-2} días!`;
        } else if (streakCount === 1) {
            streakMessage = `🟥 ¡Perdiste tu racha!`;
        } else if (streakCount === 2) {
            streakMessage = `🟨 ¡Estás a punto de entrar en racha *${streakText}*!`;
        }

        // Actualizar los datos del usuario en la base de datos
        await userRef.set({
            horas: currentHoras,
            puntos: currentPoints,
            NE: currentNE,
            E: currentE,
            SE: currentSE,
            GL: currentGL,
            streak: streak,
            streakCount: streakCount
        }, { merge: true });

        return interaction.reply({
            content: `Se registraron ${horas} horas de guita para <@${userId}>.\n${streakMessage}`,
            flags: MessageFlags.Ephemeral
        });
    } else if (action === 'subtract') {
     
        currentHoras -= horas;
        currentPoints -= horas * 50; // Assuming 1 hour = 50 points

        if (currentHoras < horas) {
            return interaction.reply({
                content: `Oye <@${userId}>, no tienes suficientes horas para restar.`,
                flags: MessageFlags.Ephemeral
            });
        }

        let streakMessage = '';
        let streakText = '';

        // Reiniciar los contadores de racha si se cambia de rango
        if (horas > 0 && horas < 6) {
            if (streak !== 'NE') {
                currentE = 0;
                currentSE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentNE += 1;
            streak = 'NE';
            streakText = 'No Efectiva';
            streakCount += 1;
        } else if (horas >= 6 && horas <= 10) {
            if (streak !== 'E') {
                currentNE = 0;
                currentSE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentE += 1;
            streak = 'E';
            streakText = 'Efectiva';
            streakCount += 1;
        } else if (horas > 10 && horas <= 12) {
            if (streak !== 'SE') {
                currentNE = 0;
                currentE = 0;
                currentGL = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentSE += 1;
            streak = 'SE';
            streakText = 'Supel Elegante';
            streakCount += 1;
        } else if (horas > 12) {
            if (streak !== 'GL') {
                currentNE = 0;
                currentE = 0;
                currentSE = 0;
                streakCount = 0;
                // Eliminar el rol anterior si cambia de racha
                if (streak && streak in roles) {
                    await member.roles.remove(roles[streak]).catch(() => {});
                }
            }
            currentGL += 1;
            streak = 'GL';
            streakText = 'GuitaLover';
            streakCount += 1;
        }

        // Verificar si se ha alcanzado una racha de 3
        if (streakCount === 3) {
            streakMessage = `🟩 ¡Has entrado en una racha *${streakText}*!`;
            // Asignar el rol correspondiente
            if (roles[streak]) {
                await member.roles.add(roles[streak]).catch(() => {});
            }
        } else if (streakCount > 3) {
            streakMessage = `🥳 ¡Has mantenido tu racha *${streakText}* por ${streakCount-2} días!`;
        } else if (streakCount === 1) {
            streakMessage = `🟥 ¡Perdiste tu racha!`;
        } else if (streakCount === 2) {
            streakMessage = `🟨 ¡Estás a punto de entrar en racha *${streakText}*!`;
        }

        // Actualizar los datos del usuario en la base de datos
        await userRef.set({
            horas: currentHoras,
            puntos: currentPoints,
            NE: currentNE,
            E: currentE,
            SE: currentSE,
            GL: currentGL,
            streak: streak,
            streakCount: streakCount
        }, { merge: true });

        return interaction.reply({
            content: `Se restaron ${horas} horas de guita para <@${userId}>.`,
            flags: MessageFlags.Ephemeral
        });

    } else {
        return interaction.reply({
            content: 'Acción no válida. Debes elegir entre "Añadir" o "Restar".',
            flags: MessageFlags.Ephemeral
        });
    }
}

import 'dotenv/config';
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import config from "./config";
import { handleMessage } from './commands/messageListener';
import { execute as executeShop } from './commands/shop';
import { execute as executeCreateItem } from './commands/createItem';
import * as commandModules from "./commands";
import { db } from './firebase';
import cron from 'node-cron'; // Importar la biblioteca cron
import moment from 'moment-timezone'; // Importar moment-timezone para manejar zonas horarias

const commands = Object(commandModules);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
});
client.once("ready", () => {
    console.log(`Sesion iniciada como: ${client.user?.tag}`);

    // Establecer la actividad del bot
    client.user?.setActivity("Tibia", { type: "PLAYING" });
    
    // Programar un mensaje diario a las 10 PM
    cron.schedule('0 22 * * *', async () => {
        const channelId = '1363914957359546540'; // Reemplaza con el ID del canal donde quieres enviar el mensaje
        const channel = client.channels.cache.get(channelId) as TextChannel;

        if (channel) {
            await channel.send('@here\n🚨 ¡Recuerda enviar tu reporte diario! 🚨');
            console.log('Mensaje diario enviado a las 10 PM.');
        } else {
            console.error(`No se pudo encontrar el canal con ID: ${channelId}`);
        }
    }, {
        timezone: "America/Caracas" // Configurar la zona horaria a GMT-4
    });

    // Programar un mensaje cada hora
    cron.schedule('0 * * * *', async () => {
        const currentHour = moment().tz("America/Caracas").hour(); // Obtener la hora actual en GMT-4

        // Verificar si la hora está entre las 7 AM (7) y las 9 PM (21)
        if (currentHour >= 7 && currentHour <= 21) {
            const channelId = '1363914957359546540'; // Reemplaza con el ID del canal donde quieres enviar el mensaje
            const channel = client.channels.cache.get(channelId) as TextChannel;

            if (channel) {
                await channel.send('⏰ @here\n¡Recuerda hacer tu informe por el canal! Cada hora cuenta. 🕒');
                console.log(`Mensaje enviado a las ${currentHour}:00 (GMT-4).`);
            } else {
                console.error(`No se pudo encontrar el canal con ID: ${channelId}`);
            }
        } else {
            console.log(`No se envió mensaje porque la hora actual (${currentHour}:00) está fuera del rango permitido (7 AM - 9 PM, GMT-4).`);
        }
    }, {
        timezone: "America/Caracas" // Configurar la zona horaria a GMT-4
    });

    // Programar la verificación de "carga" a las 12 AM
    cron.schedule('0 0 * * *', async () => {
        try {
            const usersSnapshot = await db.collection('horas_guita').get();

            if (usersSnapshot.empty) {
                console.log('No hay usuarios en la colección horas_guita.');
                return;
            }

            const guild = client.guilds.cache.get('GUILD_ID'); // Reemplaza con el ID de tu servidor
            if (!guild) {
                console.error('No se pudo encontrar el servidor.');
                return;
            }
            
            const streakRoles = {
                NE: '1364124171348742204',
                E: '1364124414928752664',
                SE: '1364124523795976222',
                GL: '1364124630528294992'
            };

            const batch = db.batch(); // Usar batch para actualizar múltiples documentos
            const updatedUsers: string[] = []; // Lista para almacenar los usuarios actualizados

            for (const doc of usersSnapshot.docs) {
                const userData = doc.data();
                const userId = doc.id;

                // Verificar el valor de "carga"
                const carga = userData.carga ?? 1;

                if (carga !== 0) {
                    // Incrementar los valores necesarios
                    const updatedData = {
                        NE: (userData.NE ?? 0) + 1,
                        globalNE: (userData.globalNE ?? 0) + 1,
                        globalNoCount: (userData.globalNoCount ?? 0) + 1,
                        noCount: (userData.noCount ?? 0) + 1,
                        carga: 1, // Reiniciar carga a 1
                        streak: 'NE', // Cambiar la racha activa a "NE"
                    };

                    console.log(`Actualizando valores para el usuario ${userId}:`, updatedData);

                    // Agregar la actualización al batch
                    batch.update(doc.ref, updatedData);

                    // Quitar el rol asociado a la racha del usuario
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        const currentStreak = userData.streak;
                        const roleId = streakRoles[currentStreak];
                        if (roleId && member.roles.cache.has(roleId)) {
                            await member.roles.remove(roleId);
                            console.log(`Rol ${currentStreak} eliminado para el usuario ${userId}.`);
                        }
                    }
                    // Agregar el usuario a la lista de actualizados
                    updatedUsers.push(userId);
                } else {
                    // Si la carga es 0, solo reiniciar el valor de carga a 1
                    batch.update(doc.ref, { carga: 1 });
                }
            }

            // Confirmar las actualizaciones en Firestore
            await batch.commit();
            console.log('Actualización de valores completada para usuarios con carga diferente de 0.');

            // Enviar un mensaje indicando los usuarios actualizados
            const channelId = '1363914957359546540'; // Reemplaza con el ID del canal donde quieres enviar el mensaje
            const channel = client.channels.cache.get(channelId) as TextChannel;

            if (channel) {
                if (updatedUsers.length > 0) {
                    const userMentions = updatedUsers.map(userId => `<@${userId}>`).join(', ');
                    await channel.send(`✅ No se reportaron hoy: ${userMentions}`);
                } else {
                    await channel.send('✅ Todos se reportaron hoy.');
                }
            } else {
                console.error(`No se pudo encontrar el canal con ID: ${channelId}`);
            }
        } catch (error) {
            console.error('Error al verificar y actualizar los valores de carga:', error);
        }
    }, {
        timezone: "America/Caracas" // Configurar la zona horaria a GMT-4
    });


    // Programar la eliminación de tareas con estado FINISHED a las 12 AM
    cron.schedule('0 */3 * * *', async () => {
        try {
            const tasksSnapshot = await db.collection('tasks').where('status', '==', 'Finished').get();

            if (tasksSnapshot.empty) {
                console.log('No hay tareas con estado Finished para eliminar.');
                return;
            }

            const channelId = '1363914957359546540'; // Reemplaza con el ID del canal donde quieres enviar el mensaje
            const channel = client.channels.cache.get(channelId) as TextChannel;

            const batch = db.batch(); // Usar batch para eliminar múltiples documentos
            tasksSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit(); // Confirmar la eliminación en Firestore

            if (channel) {
                await channel.send(`🗑️ Todas las tareas **FINALIZADAS** han sido eliminadas.`);
                console.log('Tareas con estado FINISHED eliminadas y mensaje enviado.');
            } else {
                console.error(`No se pudo encontrar el canal con ID: ${channelId}`);
            }
        } catch (error) {
            console.error('Error al eliminar tareas con estado FINISHED:', error);
        }
    }, {
        timezone: "America/Caracas" // Configurar la zona horaria a GMT-4
    });

});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) {
        return;
    }
    const { commandName } = interaction;
    // const command = commands[commandName];
    commands[commandName].execute(interaction, client);

    // if (!command) {
    //     console.error(`Command not found: ${commandName}`);
    //     await interaction.reply({ content: 'Command not found.', ephemeral: true });
    //     return;
    // }

    // try {
    //     await command.execute(interaction, client);
    // } catch (error) {
    //     console.error(`Error executing command: ${commandName}`, error);
    //     await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    // }
     
});

client.login(process.env.DISCORD_BOT_TOKEN || config.DISCORD_BOT_TOKEN);
// client.login(config.DISCORD_BOT_TOKEN);
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import config from "./config";
import { handleMessage } from './commands/messageListener';
import { execute as executeShop } from './commands/shop';
import { execute as executeCreateItem } from './commands/createItem';
import * as commandModules from "./commands";
import { db } from './firebase';
import cron from 'node-cron'; // Importar la biblioteca cron

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

    // Programar un mensaje diario a las 10 PM
    cron.schedule('0 22 * * *', async () => {
        const channelId = '1363914957359546540'; // Reemplaza con el ID del canal donde quieres enviar el mensaje
        const channel = client.channels.cache.get(channelId) as TextChannel;

        if (channel) {
            await channel.send('🚨 ¡Recuerda enviar tu reporte diario! 🚨');
            console.log('Mensaje diario enviado a las 10 PM.');
        } else {
            console.error(`No se pudo encontrar el canal con ID: ${channelId}`);
        }
    });

    // Programar la eliminación de tareas con estado FINISHED a las 12 AM
    cron.schedule('0 0 * * *', async () => {
        try {
            const tasksSnapshot = await db.collection('tasks').where('status', '==', 'Finished').get();

            if (tasksSnapshot.empty) {
                console.log('No hay tareas con estado FINISHED para eliminar.');
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

client.login(config.DISCORD_BOT_TOKEN);
import { Client, GatewayIntentBits } from "discord.js";
import config from "./config";
import { handleMessage } from './commands/messageListener';
import { execute as executeShop } from './commands/shop';
import { execute as executeCreateItem } from './commands/createItem';
import * as commandModules from "./commands";
import { db } from './firebase';

const commands = Object(commandModules);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
client.once("ready", () => {
    console.log(`Sesion iniciada como: ${client.user?.tag}`);
    // handleMessage(client);
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
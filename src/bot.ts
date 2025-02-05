import { Client, GatewayIntentBits } from "discord.js";
import config from "./config";
import * as commandModules from "./commands";
 
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
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) {
        return;
    }
    const { commandName } = interaction;
    commands[commandName].execute(interaction, client);
});

client.login(config.DISCORD_BOT_TOKEN);
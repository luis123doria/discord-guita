import { SlashCommandBuilder } from "@discordjs/builders";
import type { Client, CommandInteraction, TextChannel } from "discord.js";
import { year } from "drizzle-orm/mysql-core";

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Abre el menu de ayuda del bot')
    .addStringOption(option => 
        option
            .setName('comando')
            .setDescription('Muestra la ayuda de un comando en especifico')
            .setRequired(true)
    );


export async function execute(interaction: CommandInteraction, client: Client) {
    // Con esto te aseguras que estés escribiendo en un canal, y no en un Thread
    if(!interaction ?.channelId){
        return;
    }

    const thread = await (client.channels.cache.get(interaction.channelId) as TextChannel).threads.create({
        name: `soporte-${interaction.user.username}`,
        reason: `Un usuario solicito ayuda`,
    });
    //. getString('comando')!;               
    const problemDescription = interaction.options.get('usuario')?.value as string;
    const { user } = interaction;
    thread.send(`**Hola** <${user}>, ¿En que puedo ayudarte?
        Parece que el problema es: ${problemDescription}`);

    return interaction.reply({
        content: "La ayuda ha sido enviada",
        ephemeral: true,
    })
}
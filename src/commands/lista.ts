import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
  .setName('lista')
  .setDescription('Muestra una lista de todas las tareas en el servidor');

export async function execute(interaction: CommandInteraction) {
  try {
    const tasksSnapshot = await db.collection('tasks').get();
    if (tasksSnapshot.empty) {
      await interaction.reply({ content: 'No hay tareas en el servidor.', ephemeral: true });
      return;
    }
    
    const tasks = tasksSnapshot.docs.map(doc => doc.data());
    const tasksPerPage = 5;
    let currentPage = 0;

    const generateEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setTitle('📋 Lista de Tareas')
        .setColor('#AA00AA')
        .setTimestamp();

        const start = page * tasksPerPage;
        const end = start + tasksPerPage;
        const pageTasks = tasks.slice(start, end);

      
        pageTasks.forEach((task, index) => {
          embed.addFields(
            { name: `${start + index + 1}. 📝`, value: `• **Nombre:** ${task.name}\n• **Fecha Límite:** ${task.deadline}\n• **Duración:** ${task.duration}\n• **Asignada a:** ${task.assignedTo.join(', ')}\n\n-------------\n\n`, inline: false }
          );
        });

        return embed;
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('previous')
          .setLabel('Anterior')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Siguiente')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(tasks.length <= tasksPerPage)
      );

      await interaction.reply({ embeds: [generateEmbed(currentPage)], components: [row] });
      
      const filter = i => i.customId === 'previous' || i.customId === 'next';
      const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'previous') {
          currentPage--;
        } else if (i.customId === 'next') {
          currentPage++;
        }

        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('previous')
                  .setLabel('Anterior')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('Siguiente')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled((currentPage + 1) * tasksPerPage >= tasks.length)
              )
          ]
        });
      });

      collector.on('end', async () => {
        await interaction.editReply({ components: [] });
      });

  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Hubo un error al obtener la lista de tareas.', ephemeral: true });
  }
}
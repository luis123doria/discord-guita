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

    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('Tasks:', tasks); // Debugging line
    const tasksPerPage = 3;
    let currentPage = 0;
    let selectedTask;

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
            { name: `${start + index + 1}. 📝`, value: `• **Nombre:** ${task.name}\n• **Fecha Límite:** ${task.deadline}\n• **Asignada a:** ${task.assignedTo.join(', ')}\n• **Estado:** ${task.status}\n\n-------------\n\n`, inline: false }
          );
        });

        return embed;
    };

    const generateComponents = (page) => {
      const start = page * tasksPerPage;
      const end = start + tasksPerPage;
      const pageTasks = tasks.slice(start, end);

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
            .setDisabled((currentPage + 1) * tasksPerPage >= tasks.length)
        );

      const taskButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        ...pageTasks.map((task, index) =>
          new ButtonBuilder()
            .setCustomId(`select_${start + index + 1}`)
            .setLabel(`${start + index + 1}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const components = [taskButtons];
      if (currentPage > 0 || (currentPage + 1) * tasksPerPage < tasks.length) { // Change at line 51
        components.unshift(row);
      }

      return components;
    };
  
    await interaction.reply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });
      
    const filter = i => i.customId.startsWith('previous') || i.customId.startsWith('next') || i.customId.startsWith('select_') || i.customId === 'finish' || i.customId === 'delete' || i.customId === 'back' || i.customId === 'confirm_delete' || i.customId === 'cancel_delete';
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });


      collector.on('collect', async i => {
        if (i.customId === 'previous') {
          currentPage--;
        } else if (i.customId === 'next') {
          currentPage++;
        } else if (i.customId.startsWith('select_')) {
          const taskIndex = parseInt(i.customId.split('_')[1]) - 1;
          console.log('Task Index:', taskIndex); // Debugging line
          if (taskIndex < 0 || taskIndex >= tasks.length) {
            console.error('Invalid task index:', taskIndex); // Debugging line
            await i.reply({ content: 'No hay más tareas.', ephemeral: true }); // Change
            return;
          }
          selectedTask = tasks[taskIndex];
          console.log('Selected Task:', selectedTask); // Debugging line
          if (!selectedTask) {
            console.error('Selected Task is undefined'); // Debugging line
            await i.reply({ content: 'No hay más tareas.', ephemeral: true }); // Change
            return;
          }
          if (!selectedTask.id) {
            console.error('Selected Task ID is undefined'); // Debugging line
            await i.reply({ content: 'No hay más tareas.', ephemeral: true }); // Change
            return;
          }
          console.log('Selected Task ID:', selectedTask.id); // Debugging line
          

          console.log(typeof selectedTask); // Debugging line
          console.log(typeof selectedTask.id); // Debugging line

          const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('finish')
                .setLabel('Terminar')
                .setStyle(ButtonStyle.Success)
                .setDisabled(selectedTask.status === 'Finished'),
              new ButtonBuilder()
                .setCustomId('delete')
                .setLabel('Eliminar')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('back')
                .setLabel('Volver')
                .setStyle(ButtonStyle.Secondary)
            );

          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [actionRow]
          });
          return;
        } else if (i.customId === 'finish') {
          if (selectedTask && selectedTask.id) {
            // const taskIndex = parseInt(i.customId.split('_')[1]) - 1;
            // selectedTask = tasks[taskIndex];
            const taskId = selectedTask.id;
            await db.collection('tasks').doc(taskId).update({ status: 'Finished' });
            selectedTask.status = 'Finished';
          } else {
            console.error('Invalid task selected for finishing');
          }  
        } else if (i.customId === 'delete') {
          const confirmRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('confirm_delete')
                .setLabel('Eliminar')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
            );
  
          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [confirmRow]
          });
          return;
        } else if (i.customId === 'confirm_delete') {
            if (selectedTask && selectedTask.id) {
              const taskId = selectedTask.id;
              console.log('Deleting Task ID:', taskId); // Debugging line at line 136
              await db.collection('tasks').doc(taskId).delete();
              tasks.splice(tasks.findIndex(task => task.id === taskId), 1);
              selectedTask = null;
            } else {
              console.error('Invalid task selected for deletion'); // Debugging line
            }
        } else if (i.customId === 'cancel_delete' || i.customId === 'back') {
          selectedTask = null;
        }

        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: generateComponents(currentPage)
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
import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { db } from '../firebase';
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('todo')
  .setDescription('Muestra una lista de tareas en la base de datos (10 seg. CD)');

export async function execute(interaction: CommandInteraction) {
  try {
    // Diferir la interacción para evitar problemas de tiempo
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const tasksSnapshot = await db.collection('tasks').get();
    if (tasksSnapshot.empty) {
      await interaction.editReply({ content: 'No hay tareas en el servidor.' });
      return;
    }

    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const tasksPerPage = 3;
    let currentPage = 0;
    let selectedTask;

    const generateTaskList = (page: number) => {
      const start = page * tasksPerPage;
      const end = start + tasksPerPage;
      const pageTasks = tasks.slice(start, end);

      let taskList = `📋 **Lista de Tareas (Página ${page + 1}/${Math.ceil(tasks.length / tasksPerPage)})**\n\n`;
      pageTasks.forEach((task, index) => {
        const assignedUsers = task.assignedTo.map(user => `<@${user.id}>`).join(', ') || 'Nadie';
        taskList += `**${start + index + 1}. ${task.name}**\n`;
        taskList += `• **Fecha Límite:** ${task.deadline}\n`;
        taskList += `• **Puntos:** ${task.puntos}\n`;
        taskList += `• **Asignada a:** ${assignedUsers}\n`;
        taskList += `• **Estado:** ${task.status}\n\n`;
      });

      return taskList;
    };

    const generateComponents = (page: number) => {
      const start = page * tasksPerPage;
      const end = start + tasksPerPage;
      const pageTasks = tasks.slice(start, end);

      // Botones para seleccionar tareas
      const taskButtons = pageTasks.map((task, index) =>
        new ButtonBuilder()
          .setCustomId(`select_${start + index}`)
          .setLabel(`Seleccionar ${index + 1}`)
          .setStyle(ButtonStyle.Primary)
      );

      // Botones de navegación
      const navigationButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0), // Deshabilitar si estamos en la primera página
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Siguiente')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(end >= tasks.length) // Deshabilitar si estamos en la última página
        );

      const rows = [];
      for (let i = 0; i < taskButtons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(taskButtons.slice(i, i + 5)));
      }

      rows.push(navigationButtons);
      return rows;
    };

    await interaction.editReply({
      content: generateTaskList(currentPage),
      components: generateComponents(currentPage),
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10000,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.customId === 'previous') {
          currentPage--;
          await i.update({
            content: generateTaskList(currentPage),
            components: generateComponents(currentPage),
          });
        } else if (i.customId === 'next') {
          currentPage++;
          await i.update({
            content: generateTaskList(currentPage),
            components: generateComponents(currentPage),
          });
        } else if (i.customId.startsWith('select_')) {
          const taskIndex = parseInt(i.customId.split('_')[1], 10);
          selectedTask = tasks[taskIndex];

          if (!selectedTask) {
            await i.reply({ content: 'La tarea seleccionada ya no está disponible.', flags: MessageFlags.Ephemeral });
            return;
          }

          const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('finish')
                .setLabel('Finalizar')
                .setStyle(ButtonStyle.Success)
                .setDisabled(selectedTask.status === 'Finished'), // Deshabilitar si ya está finalizada
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
            content: `Has seleccionado la tarea: **${selectedTask.name}**\nEstado: ${selectedTask.status}\nPuntos: ${selectedTask.puntos}.`,
            components: [actionRow],
          });
        } else if (i.customId === 'finish') {
          if (!i.replied && !i.deferred) {
            await i.deferReply({ flags: MessageFlags.Ephemeral });
          }

          if (selectedTask && selectedTask.id) {
            const taskId = selectedTask.id;

            // Actualizar el estado de la tarea a "Finished"
            await db.collection('tasks').doc(taskId).update({ status: 'Finished' });
            selectedTask.status = 'Finished';

            // Asignar puntos a los usuarios involucrados
            const { assignedTo, puntos } = selectedTask;
          
            // Definir los ajustes de puntos según los roles
            const roleAdjustments = {
              NE: -0.05,  // Disminuye en un 5%
              E: 0.05,    // Aumenta en un 5%
              SE: 0.10,   // Aumenta en un 10%
              GL: 0.15,   // Aumenta en un 15%
              SI: 0.05,   // Aumenta en un 5%
              NO: -0.05,  // Disminuye en un 5%
              SNO: -0.075, // Disminuye en un 7.5%
              SMNO: -0.10, // Disminuye en un 10%
            };

            // IDs de los roles
            const roleIds = {
              NE: '1364124171348742204',
              E: '1364124414928752664',
              SE: '1364124523795976222',
              GL: '1364124630528294992',
              SI: '1364249890875637820',
              NO: '1364250038267543592',
              SNO: '1364250113282674749',
              SMNO: '1364250217645346927',
            };

            for (const user of assignedTo) {
              const userRef = db.collection('horas_guita').doc(user.id);
              const userSnapshot = await userRef.get();

              let currentPoints = userSnapshot.exists ? (userSnapshot.data()?.puntos ?? 0) : 0;

              const member = await interaction.guild.members.fetch(user.id);
              const userRoles = member.roles.cache;

              let totalAdjustment = 0;
              const rolesAfectados = [];

              for (const [role, adjustment] of Object.entries(roleAdjustments)) {
                if (userRoles.has(roleIds[role])) {
                  totalAdjustment += adjustment;
                  const roleName = interaction.guild.roles.cache.get(roleIds[role])?.name;
                  if (roleName) {
                    rolesAfectados.push(roleName);
                  }
                }
              }

              const adjustedPoints = Math.round(puntos * (1 + totalAdjustment));

              await userRef.update({ puntos: currentPoints + adjustedPoints });

              await interaction.followUp({
                content: `🎉 **Recibiste **${adjustedPoints} puntos** por completar la tarea **${selectedTask.name}**.\nAjuste aplicado por los roles: ${rolesAfectados.length > 0 ? rolesAfectados.join(', ') : 'No se aplicaron ajustes.'}`,
                flags: MessageFlags.Ephemeral,
              });
            }

            await i.editReply({ content: `La tarea **${selectedTask.name}** ha sido marcada como finalizada y se han asignado **${puntos} puntos** a sus correspondientes usuarios.\n\n*(Espera 10 segundos antes de volver a usar este comando)*`});
          } else {
            await i.editReply({ content: 'Hubo un error al finalizar la tarea. Por favor, inténtalo de nuevo.' });
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
            content: `¿Estás seguro de que deseas eliminar la tarea **${selectedTask.name}**?`,
            components: [confirmRow],
          });
        } else if (i.customId === 'confirm_delete') {
          if (selectedTask && selectedTask.id) {
            const taskId = selectedTask.id;

            await db.collection('tasks').doc(taskId).delete();
            tasks.splice(tasks.findIndex(task => task.id === taskId), 1);

            await i.update({
              content: `La tarea **${selectedTask.name}** ha sido eliminada correctamente.\n\n*(Espera 10 segundos antes de volver a usar este comando)*`,
              components: [],
            });

            selectedTask = null;
          } else {
            await i.update({
              content: 'Hubo un error al intentar eliminar la tarea. Por favor, inténtalo de nuevo.',
              components: [],
            });
          }
        } else if (i.customId === 'cancel_delete') {
          await i.update({
            content: `La eliminación de la tarea **${selectedTask.name}** ha sido cancelada.`,
            content: generateTaskList(currentPage),
            components: generateComponents(currentPage),
          });
        } else if (i.customId === 'back') {
          selectedTask = null;
          await i.update({
            content: generateTaskList(currentPage),
            components: generateComponents(currentPage),
          });
        }
      } catch (error) {
        console.error('Error al procesar la interacción:', error);

        if (!i.replied && !i.deferred) {
          await i.reply({ content: 'Hubo un error al procesar la interacción. Por favor, inténtalo de nuevo.', flags: MessageFlags.Ephemeral });
        }
      }
    });

    collector.on('end', async () => {
      try {
        if (!interaction.replied) {
          await interaction.editReply({ components: [] });
        }
      } catch (error) {
        console.error('Error al finalizar el collector:', error);
      }
    });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Hubo un error al ejecutar el comando.', flags: MessageFlags.Ephemeral });
  }
}
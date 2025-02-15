import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextChannel, ChannelType } from 'discord.js';
import { db } from '../firebase';
import schedule from 'node-schedule';

export const data = new SlashCommandBuilder()
  .setName('todolist')
  .setDescription('Muestra una lista de todos los to-dos que has creado');

export async function execute(interaction: CommandInteraction, client: Client) {
  try {
    const user = interaction.user;
    const todosSnapshot = await db.collection('todo').where('createdBy', '==', user.tag).get();
    if (todosSnapshot.empty) {
      await interaction.reply({ content: 'No has creado ningún to-do.'});
      return;
    }

    const todos = todosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // console.log('Todo\'s:', todos); // Debugging line
    const todosPerPage = 3;
    let currentPage = 0;
    let selectedTodo = null;

    const generateEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setTitle('📋 Lista de To-dos')
        .setColor('#AA00AA')
        .setTimestamp();

      const start = page * todosPerPage;
      const end = start + todosPerPage;
      const pageTodos = todos.slice(start, end);

      pageTodos.forEach((todo, index) => {
        embed.addFields(
          { name: `${start + index + 1}. 📝`, value: `• **Nombre:** ${todo.name}\n• **Fecha Límite:** ${todo.duration}\n• **Asignada a:** ${todo.assignedTo.join(', ')}\n• **Estado:** ${todo.status}\n\n-------------\n\n`, inline: false }
        );
      });

      return embed;
    };

    const generateComponents = (page) => {
        const start = page * todosPerPage;
        const end = start + todosPerPage;
        const pageTodos = todos.slice(start, end);

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
            .setDisabled((currentPage + 1) * todosPerPage >= todos.length)
        );

      const todoButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          ...pageTodos.map((todo, index) =>
            new ButtonBuilder()
              .setCustomId(`select_${start + index + 1}`)
              .setLabel(`${start + index + 1}`)
              .setStyle(ButtonStyle.Secondary)
          )
        );

        const components = [todoButtons];
      if (currentPage > 0 || (currentPage + 1) * todosPerPage < todos.length) {
        components.unshift(row);
      }

      return components;
    };

    await interaction.reply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });

    const filter = i => i.customId.startsWith('previous') || i.customId.startsWith('next') || i.customId.startsWith('select_') || i.customId === 'backlog' || i.customId === 'doing' || i.customId === 'finished' || i.customId === 'back';
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async i => {
        if (i.customId === 'previous') {
          currentPage--;
        } else if (i.customId === 'next') {
          currentPage++;
        } else if (i.customId.startsWith('select_')) {
          const todoIndex = parseInt(i.customId.split('_')[1]) - 1;
          console.log('To-do Index:', todoIndex); // Debugging line
          if (todoIndex < 0 || todoIndex >= todos.length) {
            console.error('Invalid To-do index:', todoIndex); // Debugging line
            await i.reply({ content: 'No hay más to-do\'s.', ephemeral: true });
            return;
          }
          selectedTodo = todos[todoIndex];
          console.log('Selected To-do:', selectedTodo); // Debugging line
          if (!selectedTodo) {
            console.error('Selected To-do is undefined'); // Debugging line
            await i.reply({ content: 'No hay más to-do\'s.', ephemeral: true });
            return;
          }
          if (!selectedTodo.id) {
            console.error('Selected Todo ID is undefined'); // Debugging line
            await i.reply({ content: 'No hay más to-do\'s.', ephemeral: true });
            return;
          }
          console.log('Selected To-do ID:', selectedTodo.id); // Debugging line
          const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('backlog')
                .setLabel('Backlog')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(selectedTodo.status === 'Backlog'),
              new ButtonBuilder()
                .setCustomId('doing')
                .setLabel('Doing')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(selectedTodo.status === 'Doing'),
              new ButtonBuilder()
                .setCustomId('finished')
                .setLabel('Finished')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(selectedTodo.status === 'Finished'),
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
        } else if (i.customId === 'backlog') {
          if (selectedTodo && selectedTodo.id) {
            const todoId = selectedTodo.id;
            await db.collection('todo').doc(todoId).update({ status: 'Backlog' });
            selectedTodo.status = 'Backlog';
          } else {
            console.error('Invalid to-do selected for backlog'); // Debugging line
          }
        } else if (i.customId === 'doing') {
          if (selectedTodo && selectedTodo.id) {
                const todoId = selectedTodo.id;
                await db.collection('todo').doc(todoId).update({ status: 'Doing' });
                selectedTodo.status = 'Doing';

                // Start the timer for the selected to-do

                const interval = setInterval(async () => {
                  const msDuration = timeToMs(selectedTodo.duration);
                  const newMsDuration = msDuration - 60000; // Decrease by 1 minute
                  selectedTodo.duration = msToTime(newMsDuration);
                  await db.collection('todo').doc(todoId).update({ duration: selectedTodo.duration });
      
                  if (newMsDuration <= 300000) { // 5 minutes in milliseconds
                    clearInterval(interval);
                    console.log('To-do time is up!'); // Debugging line
                    const assignedUsers = selectedTodo.assignedTo.map(tag => client.users.cache.find(user => user.tag === tag));
                    for (const user of assignedUsers) {
                      if (user) {
                        await user.send(`🚨 **Atención** 🚨\nEl tiempo de trabajo del To-do **${selectedTodo.name}** acaba en 5 minutos. ¡Muévela!`);
                      }
                    }
                  }
                }, 60000); // Decrease duration every minute

          } else {
            console.error('Invalid to-do selected for doing'); // Debugging line
          }
        } else if (i.customId === 'finished') {
          if (selectedTodo && selectedTodo.id) {
            const todoId = selectedTodo.id;
            await db.collection('todo').doc(todoId).update({ status: 'Finished' });
            selectedTodo.status = 'Finished';
          } else {
            console.error('Invalid to-do selected for finishing'); // Debugging line
          }
        } else if (i.customId === 'back') {
          selectedTodo = null;
        }
  
        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: generateComponents(currentPage)
        });
      });
  
      collector.on('end', async () => {
        await interaction.editReply({ components: [] });
      });

      // Schedule a job to delete all to-dos every day at a specific time (e.g., midnight)
      console.log('Scheduling job to delete all to-dos at 00:00 AM America/Caracas timezone');
      const job = schedule.scheduleJob({ hour: 0, minute: 0, tz: 'America/Caracas' }, async () => {
        console.log('Job started to delete all to-dos');
        const allTodosSnapshot = await db.collection('todo').where('createdBy', '==', user.tag).get();
        const batch = db.batch();
        allTodosSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('All to-dos have been deleted.');
        
        // Send a notification message to a specific channel
        const channelId = '1326025844056920132';
        const channel = client.channels.cache.get(channelId);
        if (channel && channel.type === ChannelType.GuildText) {
          await channel.send('🚨 **Atención @everyone** 🚨\nTodos los To-do han sido eliminados.');
        }
      
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Hubo un error al obtener la lista de to-do\'s.', ephemeral: true });
    }
  }

// Helper functions
function msToTime(duration: number): string {
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  const hoursStr = (hours < 10) ? "0" + hours : hours;
  const minutesStr = (minutes < 10) ? "0" + minutes : minutes;

  return hoursStr + ":" + minutesStr;
}

function timeToMs(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const ms = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
  return ms;
}
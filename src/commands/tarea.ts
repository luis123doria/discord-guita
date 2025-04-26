import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, TextChannel, EmbedBuilder, MessageReaction, User } from 'discord.js';
import { db } from '../firebase';
import schedule from 'node-schedule';

export const data = new SlashCommandBuilder()
  .setName('tarea')
  .setDescription('Crea una nueva tarea con fecha límite.')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nombre de la tarea (máx 50 carácteres)')
      .setRequired(true)
      .setMaxLength(50))
  .addStringOption(option =>
    option.setName('deadline')
      .setDescription('La fecha límite de la tarea (formato: DD-MM-YYYY)')
      .setRequired(true)
      .setMaxLength(10))
  .addIntegerOption(option =>
    option.setName('horas')
      .setDescription('Cantidad de horas estimadas para completar la tarea')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('prioridad')
      .setDescription('Nivel de impacto de la tarea')
      .setRequired(true)
      .addChoices(
        { name: 'Alto', value: 'HIGH' },
        { name: 'Medio', value: 'MEDIUM' },
        { name: 'Bajo', value: 'LOW' }
      ))
  .addUserOption(option =>
  option.setName('user1')
      .setDescription('1er usuario asignado a la tarea')
      .setRequired(true))
  .addUserOption(option =>
  option.setName('user2')
      .setDescription('2do usuario asignado a la tarea')
      .setRequired(false))
  .addUserOption(option =>
  option.setName('user3')
      .setDescription('3er usuario asignado a la tarea')
      .setRequired(false))
  .addUserOption(option =>
  option.setName('user4')
      .setDescription('4to usuario asignado a la tarea')
      .setRequired(false));
  

export async function execute(interaction: CommandInteraction) {
  try {
  const taskName = interaction.options.get('name')?.value as string;
  const deadline = interaction.options.get('deadline')?.value as string;
  const horas = interaction.options.get('horas')?.value as number;
  const prioridad = interaction.options.get('prioridad')?.value as string;
  const user = interaction.user;

  // Validar los valores
  if (!taskName || typeof taskName !== 'string') {
    throw new Error('El nombre de la tarea es inválido.');
  }
  if (!deadline || typeof deadline !== 'string') {
    throw new Error('La fecha límite es inválida.');
  }
  if (!horas || typeof horas !== 'number') {
    throw new Error('Las horas estimadas son inválidas.');
  }
  if (!prioridad || typeof prioridad !== 'string') {
    throw new Error('La prioridad es inválida.');
  }
  
  const usersInvolved: { id: string; tag: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const userOption = interaction.options.getUser(`user${i}`);
    if (userOption) {
      usersInvolved.push({ id: userOption.id, tag: userOption.tag });
    }
  }

  console.log({
    taskName,
    deadline,
    horas,
    prioridad,
    usersInvolved
  });

  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: 'Este comando solo se puede usar en canales.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📝 Nueva tarea creada')
    .addFields(
        { name: '✏️ Nombre', value: String(taskName), inline: true },
        { name: '📅 Fecha Límite', value: String(deadline), inline: true },
        { name: '⏳ Horas Estimadas', value: `${horas} horas`, inline: true },
        { name: '⚡ Prioridad', value: String(prioridad), inline: true },
        { name: '👥 Asignada a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n'), inline: true },
        { name: '📌 Estado', value: 'Doing', inline: true } // Add status field with default value
      )
      .setColor(prioridad === 'HIGH' ? '#FF0000' : prioridad === 'MEDIUM' ? '#FFA500' : '#00FF00') // Cambiar color según prioridad
    .setTimestamp();

  
    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    const thread = await interaction.channel.threads.create({
      name: `${taskName}`,
      autoArchiveDuration: 1440, // Auto-archive after 60 minutes of inactivity
      startMessage: message.id,
      reason: 'New task thread created by bot command'
    });

    // Define taskRef here to make it accessible in the entire function
    const taskRef = db.collection('tasks').doc();
    console.log("Tarea creada en Firestore", taskRef.id);
    console.log({
      taskName,
      deadline,
      horas,
      prioridad,
      usersInvolved
    });
    
    // Store task information in Firestore
    await taskRef.set({
      name: taskName,
      deadline: deadline,
      horas: horas,
      prioridad: prioridad,
      createdBy: user.tag,
      assignedTo: usersInvolved,
      status: 'Doing',
      threadId: thread.id,
      createdAt: new Date()
    });

    // Send a message in the new thread mentioning all users involved
    await thread.send(`🗒️ **Tarea asignada a:** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')}.\n**¡Buena suerte!**`);

    // Schedule a message to be sent 2 hour and 0 minutes before the deadline
    const deadlineDate = new Date(deadline.split('-').reverse().join('-') + 'T00:00:00');
    const reminderDate = new Date(deadlineDate.getTime() - (2 * 60 * 60 * 1000 + 0* 60 * 1000)); // 2 hour and 0 minutes before midnight

    schedule.scheduleJob(reminderDate, async () => {
      await thread.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa fecha límite para la tarea **${taskName}** está a punto de completarse. **¡Dense prisa!**`);
    });

    // Schedule a message at the deadline
    schedule.scheduleJob(deadlineDate, async () => {
      const taskSnapshot = await taskRef.get();
      const taskData = taskSnapshot.data();
      if (!taskData) return;

      const deadlineMessage = await thread.send(`⏰ **Se ha acabado el tiempo para la tarea "${taskName}".**\nSi quieres añadir días extra, reacciona con un número del 1️⃣ al 9️⃣.\nSi no quieres extender la fecha límite, reacciona con ❌.`);
      console.log(`Deadline message sent: ${deadlineMessage.id}`);

      // Add reactions to the message
      await deadlineMessage.react('❌');
      for (let i = 1; i <= 9; i++) {
        await deadlineMessage.react(`${i}️⃣`);
      }

      const filter = (reaction: MessageReaction, user: User) => {
        console.log(`Reaction: ${reaction.emoji.name}, User: ${user.tag}`);
        return (
          user.id === interaction.user.id &&
          (reaction.emoji.name === '❌' || /^[1-9]️⃣$/.test(reaction.emoji.name!))
        );
      };

      const collector = deadlineMessage.createReactionCollector({ 
        filter, 
        time: 60000 // 1 minuto para reaccionar
      }); 

      collector.on('collect', async (reaction, user) => {
        console.log(`Collected reaction: ${reaction.emoji.name} from user: ${user.tag}`);
        if (reaction.emoji.name === '❌') {
          collector.stop('no');
          await thread.send(`❌ **La tarea no ha sido completada en la fecha límite y será eliminada.**\nSe descontarán **${taskData.puntos} puntos** a los usuarios asignados.`);
          for (const user of usersInvolved) {
            const userRef = db.collection('horas_guita').doc(user.id);
            const userDoc = await userRef.get();
            const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
            await userRef.set({ puntos: currentPoints - taskData.puntos }, { merge: true });
          }
          // Eliminar la tarea de la base de datos
          await taskRef.delete();
        } else if (/^[1-9]️⃣$/.test(reaction.emoji.name!)) {
          const extraDays = parseInt(reaction.emoji.name![0]);
          collector.stop('extended');
          const newDeadline = new Date(deadlineDate.getTime() + extraDays * 24 * 60 * 60 * 1000);
          const newDeadlineString = newDeadline.toISOString().split('T')[0].split('-').reverse().join('-');
          const newPuntos = Math.floor(taskData.puntos * 0.9); // Reduce puntos en un 10%

          await taskRef.update({
            deadline: newDeadlineString,
            puntos: newPuntos
          });

          await thread.send(`✅ **La fecha límite ha sido extendida y los puntos por completarla han disminuido en un 10%.**\nNueva fecha límite: **${newDeadlineString}**.\nPuntos actualizados: **${newPuntos}**.`);

          // Crear un nuevo embed con la información actualizada
          const updatedEmbed = new EmbedBuilder()
          .setTitle('📝 Tarea Actualizada')
          .addFields(
            { name: '✏️ Nombre', value: taskData.name, inline: true },
            { name: '📅 Nueva Fecha Límite', value: newDeadlineString, inline: true },
            { name: '⏳ Horas Estimadas', value: `${horas} horas`, inline: true },
            { name: '⚡ Prioridad', value: prioridad, inline: true },
            { name: '👥 Asignada a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n'), inline: true },
            { name: '📌 Estado', value: 'Doing', inline: true }
          )
          .setColor('#FFA500') // Cambiar color para indicar actualización
          .setTimestamp();

          // Enviar el embed actualizado al hilo
          await thread.send({ embeds: [updatedEmbed] });
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          await thread.send(`⏰ **No se recibió respuesta. La tarea no ha sido completada y se eliminará.**\nSe descontarán **${taskData.puntos} puntos** a los usuarios asignados.`);
          for (const user of usersInvolved) {
            const userRef = db.collection('horas_guita').doc(user.id);
            const userDoc = await userRef.get();
            const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
            await userRef.set({ puntos: currentPoints - taskData.puntos }, { merge: true });
          }
          // Eliminar la tarea de la base de datos
          await taskRef.delete();
        }
      });
    });

    await interaction.followUp(`🧵 **Hilo de seguimiento creado:** <#${thread.id}>`);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Ocurrió un error al crear la tarea.', ephemeral: true });
  }
}
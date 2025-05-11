import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, TextChannel, EmbedBuilder, MessageReaction, User } from 'discord.js';
import { db } from '../firebase';
import moment from 'moment-timezone';
import { scheduleTaskJobs } from '../utils/scheduleTaskJobs';

export const data = new SlashCommandBuilder()
  .setName('tarea')
  .setDescription('Crea una nueva tarea con fecha límite.')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nombre de la tarea (máx 50 carácteres)')
      .setRequired(true)
      .setMaxLength(50))
  .addStringOption(option =>
    option.setName('horas')
      .setDescription('Cantidad de horas estimadas para completar la tarea (formato HH:MM)')
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
  const horas = interaction.options.get('horas')?.value as string;
  const prioridad = interaction.options.get('prioridad')?.value as string;
  const user = interaction.user;

  // Validar los valores
  if (!taskName || typeof taskName !== 'string') {
    throw new Error('El nombre de la tarea es inválido.');
  }
  if (!horas || typeof horas !== 'string' || !/^\d{2}:\d{2}$/.test(horas)) {
    throw new Error('El formato de tiempo es inválido. Debe ser HH:MM.');
  }
  if (!prioridad || typeof prioridad !== 'string') {
    throw new Error('La prioridad es inválida.');
  }

  const [hours, minutes] = horas.split(':').map(Number);
  const totalMilliseconds = (hours * 60 + minutes) * 60 * 1000;

  // Calcular puntos
  const priorityMultiplier = prioridad === 'HIGH' ? 70 : prioridad === 'MEDIUM' ? 20 : 10;
  const puntos = Math.round((totalMilliseconds / 3600000) * priorityMultiplier);

  const usersInvolved: { id: string; tag: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const userOption = interaction.options.getUser(`user${i}`);
    if (userOption) {
      usersInvolved.push({ id: userOption.id, tag: userOption.tag });
    }
  }

  // Calcular las fechas en UTC-4
  const startTime = moment.tz("America/Caracas"); // Hora de inicio en UTC-4
  const endTime = startTime.clone().add(totalMilliseconds, 'milliseconds'); // Hora de finalización en UTC-4
  const reminderTime = endTime.clone().subtract(30, 'minutes'); // 30 minutos antes de la finalización

  // Formatear la duración de la tarea en XXhYYm
  // const durationHours = Math.floor(totalMilliseconds / (60 * 60 * 1000));
  // const durationMinutes = Math.floor((totalMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
  // const formattedDuration = `${String(durationHours).padStart(2, '0')}h${String(durationMinutes).padStart(2, '0')}m`;

  const formattedDuration = `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`;
  const formattedEndTime = endTime.format('hh:mm A'); // Formato HH:MM AM/PM

  console.log(`Recordatorio programado para: ${reminderTime.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`Hora de finalización: ${endTime.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`Hora de inicio: ${startTime.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`Duración de la tarea: ${formattedDuration}`);

  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: 'Este comando solo se puede usar en canales.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📝 Nueva tarea creada')
    .addFields(
        { name: '✏️ Nombre', value: String(taskName), inline: true },
        // { name: '📅 Fecha Límite', value: String(deadline), inline: true },
        // { name: '⏳ Horas Estimadas', value: `${horas}`, inline: true },
        { name: '⏳ Horas Estimadas', value: `${formattedDuration}\n${formattedEndTime}`, inline: true },
        { name: '⚡ Prioridad', value: String(prioridad), inline: true },
        { name: '🏆 Puntos', value: `${puntos}`, inline: true },
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
      reason: 'Nuevo hilo para la tarea'
    });

    // Define taskRef here to make it accessible in the entire function
    const taskRef = db.collection('tasks').doc();

    console.log("Tarea creada en Firestore", taskRef.id);
    console.log({
      taskName,
      horas,
      startTime,
      endTime,
      reminderTime,
      prioridad,
      puntos,
      usersInvolved
    });

    // Store task information in Firestore
    await taskRef.set({
      name: taskName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      reminderTime: reminderTime.toISOString(),
      horas: horas,
      prioridad: prioridad,
      puntos: puntos,
      createdBy: user.tag,
      assignedTo: usersInvolved,
      status: 'Doing',
      threadId: thread?.id
    });

    // Send a message in the new thread mentioning all users involved
    await thread.send(`🗒️ **Tarea asignada a:** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')}.\n**¡Buena suerte!**`);
    
    // // Consultar Firestore para obtener los datos actualizados de la tarea
    // const taskSnapshot = await taskRef.get();
    // const taskData = taskSnapshot.data();

    // if (!taskData) {
    //   console.error('No se pudo obtener la tarea desde Firestore.');
    //   return;
    // }
    // // Obtener los valores actualizados desde Firestore
    // const updatedReminderTime = moment.tz(taskData.reminderTime, "America/Caracas");
    // const updatedEndTime = moment.tz(taskData.endTime, "America/Caracas");
    
    // console.log(`ReminderTime actualizado desde Firestore: ${updatedReminderTime.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`EndTime actualizado desde Firestore: ${updatedEndTime.format('YYYY-MM-DD HH:mm:ss')}`);

    // Programar recordatorio 30 minutos antes
    // schedule.scheduleJob(reminderTime.toDate(), async () => {
    //   console.log(`Intentando enviar recordatorio para la tarea: ${taskName}`);
    //   const taskSnapshot = await taskRef.get();
    //   const taskData = taskSnapshot.data();
    //   if (!taskData || taskData.status !== 'Doing') {
    //     console.log('La tarea no está en estado "Doing" o no existe.');
    //     return;
    //   }

    //   const now = moment.tz("America/Caracas");
    //   console.log(`Hora actual: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    //   console.log(`ReminderTime actualizado: ${updatedReminderTime.format('YYYY-MM-DD HH:mm:ss')}`);

    //   if (now.isSameOrAfter(updatedReminderTime)) {
    //     await thread?.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa tarea **${taskData.name}** expirará en 30 minutos.`);
    //     console.log('Mensaje de recordatorio enviado.');
    //   } else {
    //     console.log('El tiempo actual no coincide con el reminderTime actualizado.');
    //   }
    //   // await thread?.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa tarea **${taskName}** expirará en 30 minutos.`);
    // });

    // // Programar mensaje de expiración de la tarea
    // schedule.scheduleJob(endTime.toDate(), async () => {
    //   console.log(`Intentando enviar mensaje de expiración para la tarea: ${taskName}`);
    //   const taskSnapshot = await taskRef.get();
    //   const taskData = taskSnapshot.data();
    //   if (!taskData || taskData.status !== 'Doing') {
    //     console.log('La tarea no está en estado "Doing" o no existe.');
    //     return;
    //   }

    //   const now = moment.tz("America/Caracas");
    //   console.log(`Hora actual: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    //   console.log(`EndTime actualizado: ${updatedEndTime.format('YYYY-MM-DD HH:mm:ss')}`);

    //   if (now.isSameOrAfter(updatedEndTime)) {
    //     const deadlineMessage = await thread.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\n⏰ **Se ha acabado el tiempo para la tarea "${taskName}".**\nSi quieres añadir horas extra, reacciona con un número del 1️⃣ al 9️⃣.\nSi no quieres extender la fecha límite, reacciona con ❌.`);
    //     console.log(`Deadline message sent: ${deadlineMessage.id}`);

    //     // Add reactions to the message
    //     await deadlineMessage.react('❌');
    //     for (let i = 1; i <= 9; i++) {
    //       await deadlineMessage.react(`${i}️⃣`);
    //     }

    //     const filter = (reaction: MessageReaction, user: User) => {
    //       console.log(`Reaction: ${reaction.emoji.name}, User: ${user.tag}`);
    //       return (
    //         user.id === interaction.user.id &&
    //         (reaction.emoji.name === '❌' || /^[1-9]️⃣$/.test(reaction.emoji.name!))
    //       );
    //     };

    //     const collector = deadlineMessage.createReactionCollector({ 
    //       filter, 
    //       time: 300000 // 5 minutos para reaccionar
    //     }); 

    //     collector.on('collect', async (reaction, user) => {
    //       console.log(`Collected reaction: ${reaction.emoji.name} from user: ${user.tag}`);
    //       if (reaction.emoji.name === '❌') {
    //         collector.stop('no');
    //         await thread.send(`❌ **La tarea no ha sido completada en el tiempo límite y será eliminada.**\nSe descontarán **${taskData.puntos} puntos** a los usuarios asignados.`);
    //         for (const user of usersInvolved) {
    //           const userRef = db.collection('horas_guita').doc(user.id);
    //           const userDoc = await userRef.get();
    //           const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
    //           await userRef.set({ puntos: currentPoints - taskData.puntos }, { merge: true });
    //         }
    //         // Eliminar la tarea de la base de datos
    //         await taskRef.delete();
    //       } else if (/^[1-9]️⃣$/.test(reaction.emoji.name!)) {
    //           // const extraDays = parseInt(reaction.emoji.name![0]);
    //           collector.stop('extended');
              
    //           const extraHours = parseInt(reaction.emoji.name![0]);
    //           const currentEndTime = moment.tz(taskData.endTime, "America/Caracas"); // Ajustar a GMT-4
    //           const newEndTime = currentEndTime.add(extraHours, 'hours'); // Sumar horas al tiempo de finalización actual
    //           const newPuntos = Math.floor(taskData.puntos * 0.9); // Reduce puntos en un 10%
              
    //           // Calcular el tiempo total acumulado
    //           const [initialHours, initialMinutes] = taskData.horas.split(':').map(Number);
    //           const totalMinutes = initialHours * 60 + initialMinutes + extraHours * 60;
    //           const totalHours = Math.floor(totalMinutes / 60);
    //           const remainingMinutes = totalMinutes % 60;
    //           const totalTimeFormatted = `${String(totalHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;

    //           await taskRef.update({ 
    //             endTime: newEndTime.toISOString(),
    //             horas: totalTimeFormatted,
    //             puntos: newPuntos
    //           });

    //         // Reprogramar mensajes de advertencia y expiración
    //         // scheduleWarningAndExpirationMessages(taskRef.id, newEndTime);

    //         await thread.send(`✅ **El tiempo límite ha sido extendida y los puntos por completarla han disminuido en un 10%.**\nNueva tiempo límite: **${totalTimeFormatted}**.\nPuntos actualizados: **${newPuntos}**.`);

    //         // Crear un nuevo embed con la información actualizada
    //         const updatedEmbed = new EmbedBuilder()
    //         .setTitle('📝 Tarea Actualizada')
    //         .addFields(
    //           { name: '✏️ Nombre', value: taskData.name, inline: true },
    //           // { name: '📅 Nueva Fecha Límite', value: newDeadlineString, inline: true },
    //           { name: '⏳ Horas Estimadas', value: `${totalTimeFormatted}`, inline: true },
    //           { name: '⚡ Prioridad', value: prioridad, inline: true },
    //           { name: '🏆 Puntos', value: `${newPuntos}`, inline: true },
    //           { name: '👥 Asignada a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n'), inline: true },
    //           { name: '📌 Estado', value: 'Doing', inline: true }
    //         )
    //         .setColor('#FFA500') // Cambiar color para indicar actualización
    //         .setTimestamp();

    //         // Enviar el embed actualizado al hilo
    //         await thread.send({ embeds: [updatedEmbed] });
    //       }
    //     });

    //     collector.on('end', async (_, reason) => {
    //       if (reason === 'time') {
    //         await thread.send(`⏰ **No se recibió respuesta. La tarea no ha sido completada y se eliminará.**\nSe descontarán **${taskData.puntos} puntos** a los usuarios asignados.`);
    //         for (const user of usersInvolved) {
    //           const userRef = db.collection('horas_guita').doc(user.id);
    //           const userDoc = await userRef.get();
    //           const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
    //           await userRef.set({ puntos: currentPoints - taskData.puntos }, { merge: true });
    //         }
    //         // Eliminar la tarea de la base de datos
    //         await taskRef.delete();
    //       }
    //     });
    //   } else {
    //     console.log('El tiempo actual no coincide con el endTime actualizado.');
    //   }
    // });

    // await scheduleTaskJobs(taskRef.id, endTime, reminderTime, usersInvolved, taskName, thread);

    // Programar los trabajos iniciales
    await scheduleTaskJobs(taskRef.id, thread, usersInvolved, interaction.user.id);

    await interaction.followUp(`🧵 **Hilo de seguimiento creado:** <#${thread.id}>`);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Ocurrió un error al crear la tarea.', ephemeral: true });
  }
}

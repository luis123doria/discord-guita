import { SlashCommandBuilder } from '@discordjs/builders';
import schedule from 'node-schedule';
import moment from 'moment-timezone';
import { db } from '../firebase';
import { CommandInteraction, TextChannel, EmbedBuilder, MessageReaction, User } from 'discord.js';

export async function scheduleTaskJobs(
      taskId: string, 
      thread: any, 
      usersInvolved: { id: string; tag: string }[],
      interactionUserId: string,
      prioridad: string,
      status: string,
      endTime: string,
      reminderTime: string,
      horas: string,
      puntos: number,
      assignedTo: string[],
      assignedToId: string[],
      assignedToRoles: string[],
      assignedToRolesId: string[],
      assignedToRolesEmoji: string[],
      assignedToRolesEmojiId: string[],
) {

  try {
    const taskRef = db.collection('tasks').doc(taskId);
    const taskSnapshot = await taskRef.get();
    const taskData = taskSnapshot.data();

    if (!taskData) {
      console.error('No se pudo obtener la tarea desde Firestore.');
      return;
    }

    const reminderTime = moment.tz(taskData.reminderTime, "America/Caracas");
    const endTime = moment.tz(taskData.endTime, "America/Caracas");

    console.log(`Reprogramando trabajos para la tarea ${taskData.name}`);
    console.log(`ReminderTime: ${reminderTime.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`EndTime: ${endTime.format('YYYY-MM-DD HH:mm:ss')}`);

    // Cancelar trabajos existentes
    schedule.scheduledJobs[`reminder-${taskId}`]?.cancel();
    schedule.scheduledJobs[`expiration-${taskId}`]?.cancel();

    // Programar recordatorio 30 minutos antes
    schedule.scheduleJob(`reminder-${taskId}`, reminderTime.toDate(), async () => {
      console.log(`Intentando enviar recordatorio para la tarea: ${taskData.name}`);
      const updatedTaskSnapshot = await taskRef.get();
      const updatedTaskData = updatedTaskSnapshot.data();
      if (!updatedTaskData || updatedTaskData.status !== 'Doing') {
        console.log('La tarea no está en estado "Doing" o no existe.');
        return;
      }

      await thread?.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa tarea **${updatedTaskData.name}** expirará en 30 minutos.`);
      console.log('Mensaje de recordatorio enviado.');
    });

    // Programar mensaje de expiración de la tarea
    schedule.scheduleJob(`expiration-${taskId}`, endTime.toDate(), async () => {
      console.log(`Intentando enviar mensaje de expiración para la tarea: ${taskData.name}`);
      const updatedTaskSnapshot = await taskRef.get();
      const updatedTaskData = updatedTaskSnapshot.data();
      if (!updatedTaskData || updatedTaskData.status !== 'Doing') {
        console.log('La tarea no está en estado "Doing" o no existe.');
        return;
      }

      const deadlineMessage = await thread?.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\n⏰ **Se ha acabado el tiempo para la tarea "${updatedTaskData.name}".**`);
      console.log('Mensaje de expiración enviado.');

      // Add reactions to the message
      await deadlineMessage.react('❌');
      for (let i = 1; i <= 9; i++) {
            await deadlineMessage.react(`${i}️⃣`);
      }

      const filter = (reaction: MessageReaction, user: User) => {
            console.log(`Reaction: ${reaction.emoji.name}, User: ${user.tag}`);
            return (
                  user.id === interactionUserId &&
                  (reaction.emoji.name === '❌' || /^[1-9]️⃣$/.test(reaction.emoji.name!))
            );
      };

      const collector = deadlineMessage.createReactionCollector({ 
            filter, 
            time: 300000 // 5 minutos para reaccionar
      }); 

      collector.on('collect', async (reaction, user) => {
            console.log(`Collected reaction: ${reaction.emoji.name} from user: ${user.tag}`);
            if (reaction.emoji.name === '❌') {
                  collector.stop('no');
                  await thread.send(`❌ **La tarea no ha sido completada en el tiempo límite y será eliminada.**\nSe descontarán **${taskData.puntos} puntos** a los usuarios asignados.`);
                  for (const user of usersInvolved) {
                        const userRef = db.collection('horas_guita').doc(user.id);
                        const userDoc = await userRef.get();
                        const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;
                        await userRef.set({ puntos: currentPoints - taskData.puntos }, { merge: true });
                  }
                  // Eliminar la tarea de la base de datos
                  await taskRef.delete();
            } else if (/^[1-9]️⃣$/.test(reaction.emoji.name!)) {
                  // const extraDays = parseInt(reaction.emoji.name![0]);
                  collector.stop('extended');
                  
                  const extraHours = parseInt(reaction.emoji.name![0]);
                  const currentEndTime = moment.tz(taskData.endTime, "America/Caracas"); // Ajustar a GMT-4
                  const newEndTime = currentEndTime.add(extraHours, 'hours'); // Sumar horas al tiempo de finalización actual
                  const newReminderTime = newEndTime.clone().subtract(30, 'minutes'); // Calcular nuevo reminderTime
                  const newPuntos = Math.floor(taskData.puntos * 0.9); // Reduce puntos en un 10%
                  
                  // Calcular el tiempo total acumulado
                  const [initialHours, initialMinutes] = taskData.horas.split(':').map(Number);
                  const totalMinutes = initialHours * 60 + initialMinutes + extraHours * 60;
                  const totalHours = Math.floor(totalMinutes / 60);
                  const remainingMinutes = totalMinutes % 60;
                  const totalTimeFormatted = `${String(totalHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;

                  await taskRef.update({ 
                        endTime: newEndTime.toISOString(),
                        reminderTime: newReminderTime.toISOString(),
                        horas: totalTimeFormatted,
                        puntos: newPuntos,
                  });

                  // Reprogramar mensajes de advertencia y expiración
                  // scheduleWarningAndExpirationMessages(taskRef.id, newEndTime);

                  // Reprogramar el trabajo de recordatorio
                  schedule.scheduledJobs[`reminder-${taskId}`]?.cancel(); // Cancelar el trabajo existente

                  schedule.scheduleJob(`reminder-${taskId}`, newReminderTime.toDate(), async () => {
                  const updatedTaskSnapshot = await taskRef.get();
                  const updatedTaskData = updatedTaskSnapshot.data();
                  if (!updatedTaskData || updatedTaskData.status !== 'Doing') return;

                  await thread?.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa tarea **${updatedTaskData.name}** expirará en 30 minutos.`);
                  });

                  await thread.send(`✅ **El tiempo límite ha sido extendido y los puntos por completarla han disminuido en un 10%.**\nNuevo tiempo límite: **${totalTimeFormatted}**.\nPuntos actualizados: **${newPuntos}**.`);
                  
                  console.log('taskData.name:', taskData.name);
                  console.log('totalTimeFormatted:', totalTimeFormatted);
                  console.log('prioridad:', prioridad);
                  console.log('newPuntos:', newPuntos);
                  console.log('usersInvolved:', usersInvolved.map(u => `• ${u.tag}`).join('\n'));
                  
                  // Crear un nuevo embed con la información actualizada
                  const updatedEmbed = new EmbedBuilder()
                        .setTitle('📝 Tarea Actualizada')
                        .addFields(
                        { name: '✏️ Nombre', value: taskData.name || 'Sin nombre', inline: true }, // Valor predeterminado
                        { name: '⏳ Horas Estimadas', value: totalTimeFormatted || '00:00', inline: true }, // Valor predeterminado
                        { name: '⚡ Prioridad', value: taskData.prioridad || 'Sin prioridad', inline: true }, // Valor predeterminado
                        { name: '🏆 Puntos', value: `${newPuntos || 0}`, inline: true }, // Valor predeterminado
                        { name: '👥 Asignada a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n') || 'Sin asignar', inline: true }, // Valor predeterminado
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
  } catch (error) {
    console.error('Error al programar los trabajos:', error);
  }
}
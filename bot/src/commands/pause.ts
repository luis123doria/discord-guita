import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, ThreadChannel } from 'discord.js';
import { db } from '../firebase';
import moment from 'moment-timezone'; // Importar moment-timezone para manejar zonas horarias
import { MessageFlags } from 'discord.js';
import { scheduleTaskJobs } from '../utils/scheduleTaskJobs';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o reanuda una tarea en un hilo.');

// Función para formatear el tiempo restante en XXhYYm
function formatTime(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`;
}

export async function execute(interaction: CommandInteraction) {
  try {
    // Verificar si el comando se ejecuta en un hilo
    if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
      return interaction.reply({
        content: '❌ Este comando solo puede ejecutarse en un hilo creado por el comando `/tarea`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Buscar la tarea correspondiente al hilo
    const thread = interaction.channel as ThreadChannel;
    const taskSnapshot = await db.collection('tasks').where('threadId', '==', thread.id).get();

    if (taskSnapshot.empty) {
      return interaction.reply({
        content: '❌ No se encontró ninguna tarea asociada a este hilo.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const taskDoc = taskSnapshot.docs[0];
    const taskData = taskDoc.data();

    // Verificar el estado actual de la tarea
    const currentStatus = taskData.status;

    const currentEndTime = moment.tz(taskData.endTime, "America/Caracas"); // Hora de finalización en UTC-4
    const currentTimeRemaining = taskData.timeRemaining ?? currentEndTime.diff(moment.tz("America/Caracas"));

    // Asegurarse de que endTime sea válido
    if (!taskData.endTime) {
      return interaction.reply({
        content: '❌ No se encontró una hora de finalización válida para esta tarea.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!currentEndTime.isValid()) {
      return interaction.reply({
        content: '❌ La hora de finalización de la tarea no es válida.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (currentStatus === 'Doing') {

      // Calcular el tiempo restante
      const now = moment.tz("America/Caracas"); // Hora actual en UTC-4
      const timeRemaining = Math.max(0, currentEndTime.diff(now));

      console.log(`\n\nTarea pausada. \n`);
      console.log(`Hora actual: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`Hora de finalización: ${currentEndTime.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`Tiempo restante calculado: ${formatTime(timeRemaining)}`);
      console.log('Recordatorio:', taskData.reminderTime);

      if (timeRemaining === 0) {
        return interaction.reply({
          content: '❌ La tarea ya ha expirado y no se puede pausar.',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Pausar la tarea
      await taskDoc.ref.update({
        status: 'Paused',
        timeRemaining: timeRemaining, // Guardar el tiempo restante
      });

      await interaction.reply({
        content: `⏸️ La tarea **${taskData.name}** ha sido pausada. Tiempo restante: **${formatTime(timeRemaining)}**.`,
      });
    } else if (currentStatus === 'Paused') {
      // Reanudar la tarea
      const newEndTime = moment.tz("America/Caracas").add(currentTimeRemaining, 'milliseconds'); // Calcular nueva hora de finalización
      const newReminderTime = newEndTime.clone().subtract(30, 'minutes'); // Recalcular reminderTime
      
      await taskDoc.ref.update({
        status: 'Doing',
        // endTime: newEndTime.format('YYYY-MM-DDTHH:mm:ssZ'), // Guardar en UTC-4
        // reminderTime: newReminderTime.format('YYYY-MM-DDTHH:mm:ssZ'), // Guardar en UTC-4
        endTime: newEndTime.toISOString(),
        reminderTime: newReminderTime.toISOString(),
        timeRemaining: null, // Limpiar el tiempo restante
      });

      console.log(`\n\nTarea reanudada. \n`);
      console.log(`Nueva hora de finalización: ${newEndTime.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`Nuevo tiempo de recordatorio: ${newReminderTime.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`Tiempo restante al reanudar: ${formatTime(currentTimeRemaining)}`);
      
      await scheduleTaskJobs(taskDoc.id, thread, taskData.assignedTo, interaction.user.id);

      await interaction.reply({
        content: `▶️ La tarea **${taskData.name}** ha sido reanudada. Tiempo restante: **${formatTime(currentTimeRemaining)}**.\nNueva hora de finalización: **${newEndTime.format('hh:mm A')}**.`,
      });
    } else {
      return interaction.reply({
        content: '❌ El estado de la tarea no permite pausar o reanudar.',
        flags: MessageFlags.Ephemeral,
      });
    }
    
        // const currentEndTime = moment.tz(taskData.endTime, "America/Caracas"); // Ajustar a GMT-4
        // const currentTimeRemaining = taskData.timeRemaining ?? currentEndTime.diff(moment.tz("America/Caracas"));
        
        // if (currentStatus === 'Doing') {
        //   // Pausar la tarea
        //   const timeRemaining = Math.max(0, currentEndTime.diff(moment.tz("America/Caracas")));
        //   await taskDoc.ref.update({
        //     status: 'En Pausa',
        //     timeRemaining: timeRemaining, // Guardar el tiempo restante
        //   });

        //   await interaction.reply({
        //     content: `⏸️ La tarea **${taskData.name}** ha sido pausada. Tiempo restante: **${formatTime(timeRemaining)}**.`,
        //   });
        // } else if (currentStatus === 'En Pausa') {
        //   // Reanudar la tarea
        //   const newEndTime = moment.tz("America/Caracas").add(currentTimeRemaining, 'milliseconds'); // Calcular nueva hora de finalización
        //   await taskDoc.ref.update({
        //     status: 'Doing',
        //     endTime: newEndTime.toISOString(), // Actualizar la nueva hora de finalización
        //     timeRemaining: null, // Limpiar el tiempo restante
        //   });

        //   await interaction.reply({
        //     content: `▶️ La tarea **${taskData.name}** ha sido reanudada. Tiempo restante: **${formatTime(currentTimeRemaining)}**.\nNueva hora de finalización: **${newEndTime.format('HH:mm')}**.`,
        //   });
        // } else {
        //   return interaction.reply({
        //     content: '❌ El estado de la tarea no permite pausar o reanudar.',
        //     ephemeral: true,
        //   });
        // }
  } catch (error) {
    console.error('Error al ejecutar el comando /pause:', error);
    await interaction.reply({
      content: '❌ Ocurrió un error al intentar pausar o reanudar la tarea.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
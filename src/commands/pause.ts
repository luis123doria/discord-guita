import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, ThreadChannel } from 'discord.js';
import { db } from '../firebase';
import moment from 'moment-timezone'; // Importar moment-timezone para manejar zonas horarias

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o reanuda una tarea en un hilo.');

export async function execute(interaction: CommandInteraction) {
  try {
    // Verificar si el comando se ejecuta en un hilo
    if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
      return interaction.reply({
        content: '❌ Este comando solo puede ejecutarse en un hilo creado por el comando `/tarea`.',
        ephemeral: true,
      });
    }

    const thread = interaction.channel as ThreadChannel;

    // Buscar la tarea correspondiente al hilo
    const taskSnapshot = await db.collection('tasks').where('threadId', '==', thread.id).get();

    if (taskSnapshot.empty) {
      return interaction.reply({
        content: '❌ No se encontró ninguna tarea asociada a este hilo.',
        ephemeral: true,
      });
    }

    const taskDoc = taskSnapshot.docs[0];
    const taskData = taskDoc.data();

    // Verificar el estado actual de la tarea
    const currentStatus = taskData.status;
    const currentEndTime = moment.tz(taskData.endTime, "America/Caracas"); // Ajustar a GMT-4
    const currentTimeRemaining = taskData.timeRemaining ?? currentEndTime.diff(moment.tz("America/Caracas"));
    
    if (currentStatus === 'Doing') {
      // Pausar la tarea
      const timeRemaining = Math.max(0, currentEndTime.diff(moment.tz("America/Caracas")));
      await taskDoc.ref.update({
        status: 'En Pausa',
        timeRemaining: timeRemaining, // Guardar el tiempo restante
      });

      await interaction.reply({
        content: `⏸️ La tarea **${taskData.name}** ha sido pausada. Tiempo restante: **${formatTime(timeRemaining)}**.`,
      });
    } else if (currentStatus === 'En Pausa') {
      // Reanudar la tarea
      const newEndTime = moment.tz("America/Caracas").add(currentTimeRemaining, 'milliseconds'); // Calcular nueva hora de finalización
      await taskDoc.ref.update({
        status: 'Doing',
        endTime: newEndTime.toISOString(), // Actualizar la nueva hora de finalización
        timeRemaining: null, // Limpiar el tiempo restante
      });

      await interaction.reply({
        content: `▶️ La tarea **${taskData.name}** ha sido reanudada. Nueva hora de finalización: **${newEndTime.format('HH:mm')}**.`,
      });
    } else {
      return interaction.reply({
        content: '❌ El estado de la tarea no permite pausar o reanudar.',
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('Error al ejecutar el comando /pause:', error);
    await interaction.reply({
      content: '❌ Ocurrió un error al intentar pausar o reanudar la tarea.',
      ephemeral: true,
    });
  }
}

// Función para formatear el tiempo restante en HH:MM
function formatTime(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
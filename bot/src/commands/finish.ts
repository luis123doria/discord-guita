import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, ThreadChannel } from 'discord.js';
import { db } from '../firebase';
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('finish')
  .setDescription('Marca la tarea asociada al hilo como finalizada.');

export async function execute(interaction: CommandInteraction) {
      try {
            // Verificar si el comando se ejecuta en un hilo
            if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
                  return interaction.reply({
                        content: '❌ Este comando solo puede ejecutarse en un hilo creado por una tarea.',
                        flags: MessageFlags.Ephemeral,
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

            // Verificar si la tarea ya está finalizada
            if (taskData.status === 'Finished') {
            return interaction.reply({
                  content: '❌ Esta tarea ya ha sido marcada como finalizada.',
                  flags: MessageFlags.Ephemeral,
            });
            }

            // Actualizar el estado de la tarea a FINISHED
            await taskDoc.ref.update({ status: 'Finished' });

            // Asignar puntos a los usuarios involucrados
            const { assignedTo, puntos } = taskData;

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
                  const userDoc = await userRef.get();
                  const currentPoints = userDoc.exists ? (userDoc.data()?.puntos ?? 0) : 0;

                  // Determinar el ajuste de puntos según el rol del usuario
                  const member = await thread.guild?.members.fetch(user.id);
                  let adjustment = 0;

                  if (member) {
                        for (const [role, roleId] of Object.entries(roleIds)) {
                              if (member.roles.cache.has(roleId)) {
                                    adjustment = roleAdjustments[role];
                                    break;
                              }
                        }
                  }

                  // Calcular los puntos finales
                  const adjustedPoints = Math.floor(puntos + puntos * adjustment);
                  const newPoints = currentPoints + adjustedPoints;

                  // Actualizar los puntos del usuario en la base de datos
                  await userRef.set({ puntos: newPoints }, { merge: true });
            }
            
            // Responder al usuario
            await interaction.reply({ 
                  content: `✅ La tarea **${taskData.name}** ha sido marcada como finalizada y se han asignado **${puntos} puntos** a sus correspondientes usuarios.`
            });

      } catch (error) {
            console.error('Error al ejecutar el comando /finish:', error);
            await interaction.reply({
                  content: '❌ Ocurrió un error al intentar finalizar la tarea.',
                  ephemeral: true,
            });
      }
}
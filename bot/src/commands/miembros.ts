import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, ThreadChannel, User } from "discord.js";
import { db } from "../firebase";
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName("miembros")
  .setDescription("Añade o elimina miembros de una tarea.")
  .addUserOption(option =>
    option
      .setName("usuario")
      .setDescription("El usuario que deseas añadir o eliminar.")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("opcion")
      .setDescription("Selecciona si deseas agregar o eliminar al usuario.")
      .setRequired(true)
      .addChoices(
        { name: "Agregar", value: "add" },
        { name: "Eliminar", value: "remove" }
      )
  );

export async function execute(interaction: CommandInteraction) {
  try {
    // Verificar si el comando se ejecuta dentro de un hilo
    if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
      return interaction.reply({
        content: "❌ Este comando solo puede ejecutarse dentro de un hilo creado por una tarea.",
        flags: MessageFlags.Ephemeral
      });
    }

    const thread = interaction.channel as ThreadChannel;

    // Obtener la tarea asociada al hilo
    const taskSnapshot = await db
      .collection("tasks")
      .where("threadId", "==", thread.id)
      .get();

    if (taskSnapshot.empty) {
      return interaction.reply({
        content: "❌ No se encontró ninguna tarea asociada a este hilo.",
        flags: MessageFlags.Ephemeral
      });
    }

    const taskDoc = taskSnapshot.docs[0];
    const taskData = taskDoc.data();

    // Obtener las opciones del comando
    const user = interaction.options.getUser("usuario") as User;
    const option = interaction.options.getString("opcion");

    if (!user || !option) {
      return interaction.reply({
        content: "❌ Debes especificar un usuario y una opción válida (Agregar o Eliminar).",
        flags: MessageFlags.Ephemeral
      });
    }

    const assignedTo = taskData.assignedTo || [];

    if (option === "add") {
      // Verificar si el usuario ya está asignado
      if (assignedTo.some(member => member.id === user.id)) {
        return interaction.reply({
          content: `❌ El usuario <@${user.id}> ya está asignado a esta tarea.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Agregar el usuario al array
      assignedTo.push({ id: user.id, tag: user.tag });

      await taskDoc.ref.update({
        assignedTo: assignedTo,
      });

      return interaction.reply({
            content: `✅ El usuario <@${user.id}> ha sido añadido a la tarea.`,
          });
        } else if (option === "remove") {
          // Verificar si el usuario está asignado
            if (!assignedTo.some(member => member.id === user.id)) {
                  return interaction.reply({
                  content: `❌ El usuario <@${user.id}> no está asignado a esta tarea.`,
                  flags: MessageFlags.Ephemeral
                  });
            }

            // Eliminar el usuario del array
            const updatedAssignedTo = assignedTo.filter(member => member.id !== user.id);

            await taskDoc.ref.update({
            assignedTo: updatedAssignedTo,
            });

            // Eliminar al usuario del hilo
            try {
                  await thread.members.remove(user.id);
                  return interaction.reply({
                  content: `✅ El usuario <@${user.id}> ha sido eliminado de la tarea y ya no puede ver este hilo.`,
                  });
            } catch (error) {
                  console.error(`Error al eliminar al usuario del hilo: ${error}`);
                  return interaction.reply({
                  content: `✅ El usuario <@${user.id}> ha sido eliminado de la tarea, pero ocurrió un error al intentar eliminarlo del hilo.`,
                  });
            }
      } else {
      return interaction.reply({
            content: "❌ Opción inválida. Usa 'Agregar' o 'Eliminar'.",
            flags: MessageFlags.Ephemeral
      });
      }
  } catch (error) {
    console.error("Error al ejecutar el comando /miembros:", error);
    return interaction.reply({
      content: "❌ Ocurrió un error al intentar ejecutar este comando.",
      flags: MessageFlags.Ephemeral
    });
  }
}
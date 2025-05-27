import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, ThreadChannel } from "discord.js";
import { db } from "../firebase";
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName("descripcion")
  .setDescription("Crea o edita la descripción de una tarea.")
  .addStringOption(option =>
    option
      .setName("texto")
      .setDescription("La descripción de la tarea.")
      .setRequired(true)
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

    // Obtener la descripción proporcionada por el usuario
    const descripcion = interaction.options.getString("texto", true);

    // Actualizar la descripción en Firestore
    await taskDoc.ref.update({
      descripcion: descripcion,
    });

    return interaction.reply({
      content: `✅ La descripción de la tarea ha sido actualizada:\n\n"${descripcion}"`,
    });
  } catch (error) {
    console.error("Error al ejecutar el comando /descripcion:", error);
    return interaction.reply({
      content: "❌ Ocurrió un error al intentar actualizar la descripción de la tarea.",
      flags: MessageFlags.Ephemeral
    });
  }
}
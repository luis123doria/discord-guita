import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { db } from "../firebase";
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName("reporte")
  .setDescription("Registra un reporte para un usuario.")
  .addUserOption(option =>
    option
      .setName("usuario")
      .setDescription("Menciona al usuario para registrar el reporte.")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("opcion")
      .setDescription("Selecciona SI o NO para el reporte.")
      .setRequired(true)
      .addChoices(
        { name: "SI", value: "SI" },
        { name: "NO", value: "NO" }
      )
  );

export async function execute(interaction: CommandInteraction) {
  const userId = interaction.options.getUser("usuario")?.id;
  const opcion = interaction.options.getString("opcion");

  if (!userId || !opcion) {
    return interaction.reply({
      content: "Debes mencionar a un usuario y seleccionar una opción válida.",
      flags: MessageFlags.Ephemeral
    });
  }

  // Obtener el servidor y el miembro
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({
      content: "Este comando solo puede usarse en un servidor.",
      flags: MessageFlags.Ephemeral
    });
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return interaction.reply({
      content: "No se pudo encontrar al usuario en este servidor.",
      flags: MessageFlags.Ephemeral
    });
  }

  // Referencia a la base de datos
  const userRef = db.collection("horas_guita").doc(userId);
  const userDoc = await userRef.get();

  // Obtener los contadores actuales
  let siCount = userDoc.exists ? (userDoc.data()?.siCount ?? 0) : 0;
  let noCount = userDoc.exists ? (userDoc.data()?.noCount ?? 0) : 0;

  // IDs de los roles
  const roles = {
    SI: "1364249890875637820",   // Reemplaza con el ID del rol 'SI'
    NO: "1364250038267543592",   // Reemplaza con el ID del rol 'NO'
    SNO: "1364250113282674749", // Reemplaza con el ID del rol 'SNO'
    SMNO: "1364250217645346927" // Reemplaza con el ID del rol 'SMNO'
  };

  let responseMessage = "";

  if (opcion === "SI") {
      // Reiniciar el contador de NO si se selecciona SI
      if (noCount > 0) {
            noCount = 0;
            await member.roles.remove(roles.NO).catch(() => {});
            await member.roles.remove(roles.SNO).catch(() => {});
            await member.roles.remove(roles.SMNO).catch(() => {});
      }
      siCount += 1;
      responseMessage = `✅ Se registró el reporte de  <@${userId}> .`;

      // Asignar el rol 'SI' si el contador llega a 3
      if (siCount === 3) {
            await member.roles.add(roles.SI).catch(() => {});
            responseMessage += `\n🎉 ¡<@${userId}> es un Buen Reportero!`;
      } else if (siCount > 3) {
            responseMessage += `\n🥳 ¡Has mantenido tu racha de **Buen reportero** por ${siCount-2} días!`;
      }
  } else if (opcion === "NO") {
      // Reiniciar el contador de SI si se selecciona NO
      if (siCount > 0) {
            siCount = 0;
            await member.roles.remove(roles.SI).catch(() => {});
      }
      noCount += 1;
      responseMessage = `⛔ No se registró el reporte de  <@${userId}> .`;

      // Asignar roles según el valor del contador 'NO'
      if (noCount === 7) {
            await member.roles.add(roles.NO).catch(() => {});
            responseMessage += `\n<@${userId}> es un mal reportero.`;
      } else if (noCount === 15) {
            await member.roles.add(roles.SNO).catch(() => {});
            await member.roles.remove(roles.NO).catch(() => {});
            responseMessage += `\n<@${userId}> es un super mal reportero.`;
      } else if (noCount >= 30) {
            await member.roles.add(roles.SMNO).catch(() => {});
            await member.roles.remove(roles.SNO).catch(() => {});
            responseMessage += `\n<@${userId}> es un super mega mal reportero. Chúpala perra`;
      }
  }

  // Actualizar los datos en Firebase
  await userRef.set(
    {
      siCount: siCount,
      noCount: noCount,
    },
    { merge: true }
  );

  // Responder al usuario
  return interaction.reply({
    content: responseMessage,
    flags: MessageFlags.Ephemeral
  });
}
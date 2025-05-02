import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, User } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
  .setName('gift')
  .setDescription('Regala horas o puntos a otro usuario.')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('El usuario al que deseas regalar.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('regalo')
      .setDescription('Selecciona si regalarás horas o puntos.')
      .setRequired(true)
      .addChoices(
        { name: 'Horas', value: 'horas' },
        { name: 'Puntos', value: 'puntos' }
      ))
  .addIntegerOption(option =>
    option.setName('cantidad')
      .setDescription('Cantidad de horas o puntos que deseas regalar.')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('mensaje')
      .setDescription('Mensaje que se enviará al destinatario.')
      .setRequired(true));

export async function execute(interaction: CommandInteraction) {
  try {
    const senderId = interaction.user.id;
    const recipient = interaction.options.getUser('usuario', true);
    const giftType = interaction.options.getString('regalo', true);
    const amount = interaction.options.getInteger('cantidad', true);
    const message = interaction.options.getString('mensaje', true);

    // Obtener datos del usuario que invoca el comando
    const senderRef = db.collection('horas_guita').doc(senderId);
    const senderDoc = await senderRef.get();

    if (!senderDoc.exists) {
      return interaction.reply({
        content: '❌ No tienes datos registrados para regalar horas o puntos.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const senderData = senderDoc.data();
    const senderBalance = senderData[giftType] ?? 0;

    // Verificar si el usuario tiene suficientes horas o puntos
    if (amount > senderBalance) {
      return interaction.reply({
        content: `❌ No tienes suficientes ${giftType} para regalar. Tu saldo actual es: **${senderBalance} ${giftType}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Obtener datos del usuario destinatario
    const recipientRef = db.collection('horas_guita').doc(recipient.id);
    const recipientDoc = await recipientRef.get();
    const recipientData = recipientDoc.exists ? recipientDoc.data() : {};

    // Actualizar los datos del remitente y destinatario
    await senderRef.update({
      [giftType]: senderBalance - amount,
    });

    await recipientRef.set({
      [giftType]: (recipientData[giftType] ?? 0) + amount,
    }, { merge: true });

    // Enviar un DM al destinatario
    try {
      await recipient.send(`🎁 **Has recibido un regalo de ${interaction.user.tag}!**\n**${amount} ${giftType}** han sido añadidos a tu cuenta.\n\nMensaje: "${message}"`);
    } catch (error) {
      console.error(`No se pudo enviar un DM a ${recipient.tag}:`, error);
    }

    // Responder al usuario que invocó el comando
    await interaction.reply({
      content: `✅ Has regalado **${amount} ${giftType}** a **${recipient.tag}**.\nMensaje enviado: "${message}"`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('Error al ejecutar el comando /gift:', error);
    await interaction.reply({
      content: '❌ Ocurrió un error al intentar procesar tu regalo.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
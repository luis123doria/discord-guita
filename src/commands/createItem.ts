import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, TextChannel, EmbedBuilder, Client } from 'discord.js';
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
  .setName('createitem')
  .setDescription('Crea un nuevo item para la tienda.')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nombre del item')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('price')
      .setDescription('Precio en GUITA COINS')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Descripción del item')
      .setRequired(true));

export async function execute(interaction: CommandInteraction, client: Client) {
  const itemName = interaction.options.get('name')?.value as string;
  const itemPrice = parseInt(interaction.options.get('price')?.value as string, 10);
  const itemDescription = interaction.options.get('description')?.value as string;

      if (itemPrice <= 0) {
            await interaction.reply({ content: 'Invalid item price. Please enter a positive number.', ephemeral: true });
            return;
      }

      if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
            await interaction.reply({ content: 'Este comando solo se puede usar en canales.', ephemeral: true });
            return;
      }

      const embed = new EmbedBuilder()
            .setTitle('✅ Nuevo item creado')
            .addFields(
                  { name: '📦 Nombre', value: itemName, inline: true },
                  { name: '💰 Precio', value: itemPrice.toString(), inline: true },
                  { name: '📝 Descripción', value: itemDescription, inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();

      try {            
            // Store items in Firestore
            await db.collection('shopItems').add({
                  name: itemName,
                  price: itemPrice,
                  description: itemDescription,
                  createdAt: new Date()
            });

            await interaction.reply({ embeds: [embed], fetchReply: true});
            await interaction.followUp(`🖍️ El Item "${itemName}" se ha añadido a la tienda.`);
      } catch (error) {
            console.error('Error creating item:', error);
            await interaction.reply({ content: 'Error creating item. Please try again.', ephemeral: true });
      }
}
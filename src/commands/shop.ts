import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Client } from 'discord.js';
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Muestra la tienda y los items disponibles.');

export async function execute(interaction: CommandInteraction, client: Client) {
  try {
    const shopItemsSnapshot = await db.collection('shopItems').get();
    if (shopItemsSnapshot.empty) {
      await interaction.reply({ content: 'The shop is currently empty.', ephemeral: true });
      return;
    }

    const shopItems = shopItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const itemsPerPage = 3;
    let currentPage = 0;
    let selectedItem = null;
    
    const generateEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setTitle('🛒 Shop')
        .setColor('#FFD700')
        .setTimestamp();

      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageItems = shopItems.slice(start, end);

      pageItems.forEach((item, index) => {
        embed.addFields(
          { name: `${start + index + 1}. ${item.name}`, value: `Price: ${item.price} GOLD COINS\nDescription: ${item.description}`, inline: false }
        );
      });

      return embed;
    };

    const generateComponents = (page) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageItems = shopItems.slice(start, end);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((currentPage + 1) * itemsPerPage >= shopItems.length)
        );

      const itemButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          ...pageItems.map((item, index) =>
            new ButtonBuilder()
              .setCustomId(`select_${start + index + 1}`)
              .setLabel(`${start + index + 1}`)
              .setStyle(ButtonStyle.Secondary)
          )
        );

      const components = [itemButtons];
      if (currentPage > 0 || (currentPage + 1) * itemsPerPage < shopItems.length) {
        components.unshift(row);
      }

      return components;
    };

    await interaction.reply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });

    const filter = i => i.customId.startsWith('previous') || i.customId.startsWith('next') || i.customId.startsWith('select_') || i.customId === 'buy' || i.customId === 'go_back' || i.customId === 'confirm' || i.customId === 'cancel';
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'previous') {
        currentPage--;
      } else if (i.customId === 'next') {
        currentPage++;
      } else if (i.customId.startsWith('select_')) {
        const itemIndex = parseInt(i.customId.split('_')[1]) - 1;
        if (itemIndex < 0 || itemIndex >= shopItems.length) {
          await i.reply({ content: 'Invalid item selected.', ephemeral: true });
          return;
        }
        selectedItem = shopItems[itemIndex];
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('buy')
              .setLabel('Buy')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('go_back')
              .setLabel('Go Back')
              .setStyle(ButtonStyle.Secondary)
          );

        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: [actionRow]
        });
        return;
      } else if (i.customId === 'buy') {
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm')
              .setLabel('Confirm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger)
          );

        await i.update({
          content: `Are you sure you want to buy ${selectedItem.name} for ${selectedItem.price} GOLD COINS?`,
          components: [actionRow]
        });
        return;
      } else if (i.customId === 'go_back') {
        selectedItem = null;
      } else if (i.customId === 'confirm') {
        const userRef = db.collection('users').doc(i.user.id);
        const userDoc = await userRef.get();
        if (!userDoc.exists || userDoc.data().balance < selectedItem.price) {
          await i.reply({ content: 'You do not have enough GOLD COINS to buy this item.', ephemeral: true });
          return;
        }

        await userRef.update({ balance: userDoc.data().balance - selectedItem.price });
        await i.reply({ content: `You have successfully bought ${selectedItem.name} for ${selectedItem.price} GOLD COINS.`, ephemeral: true });
        selectedItem = null;
      } else if (i.customId === 'cancel') {
        selectedItem = null;
      }

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: generateComponents(currentPage)
      });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] });
    });

  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error displaying the shop.', ephemeral: true });
  }
}
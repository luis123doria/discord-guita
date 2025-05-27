import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Client, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchSheetData } from './fetch'; // Asegúrate de que esta función esté disponible para obtener datos de Google Sheets
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Muestra la tienda y los items disponibles (10 seg. CD).');


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

export async function execute(interaction: CommandInteraction, client: Client) {
  try {
    await interaction.reply({ content: 'Cargando ítems de la tienda...'});
    
    // Obtener los ítems de la hoja de cálculo BENEFICIOS
    const beneficiosData = await fetchSheetData('BENEFICIOS', 'A1:D6');
    const shopItems = beneficiosData.slice(1).map(row => ({
      codigo: row[0],
      costo: parseInt(row[1], 10),
      premio: row[2],
      requisitos: parseInt(row[3], 10),
    }));

    if (shopItems.length === 0) {
      await interaction.editReply({ content: 'No hay ítems disponibles en la tienda.' });
      return;
    }

    let currentPage = 0;
    const itemsPerPage = 3;
    let selectedItem = null;

    // const generateEmbed = (page) => {
    //   const embed = new EmbedBuilder()
    //     .setTitle('🛒 Shop')
    //     .setColor('#FFD700')
    //     .setTimestamp();

    //   const start = page * itemsPerPage;
    //   const end = start + itemsPerPage;
    //   const pageItems = shopItems.slice(start, end);

    //   pageItems.forEach((item, index) => {
    //     embed.addFields(
    //       { name: `${start + index + 1}. ${item.name}`, value: `Price: ${item.price} GOLD COINS\nDescription: ${item.description}`, inline: false }
    //     );
    //   });

    //   return embed;
    // };

    // const generateComponents = (page) => {
    //   const start = page * itemsPerPage;
    //   const end = start + itemsPerPage;
    //   const pageItems = shopItems.slice(start, end);

    //   const row = new ActionRowBuilder<ButtonBuilder>()
    //     .addComponents(
    //       new ButtonBuilder()
    //         .setCustomId('previous')
    //         .setLabel('Previous')
    //         .setStyle(ButtonStyle.Primary)
    //         .setDisabled(currentPage === 0),
    //       new ButtonBuilder()
    //         .setCustomId('next')
    //         .setLabel('Next')
    //         .setStyle(ButtonStyle.Primary)
    //         .setDisabled((currentPage + 1) * itemsPerPage >= shopItems.length)
    //     );

    //   const itemButtons = new ActionRowBuilder<ButtonBuilder>()
    //     .addComponents(
    //       ...pageItems.map((item, index) =>
    //         new ButtonBuilder()
    //           .setCustomId(`select_${start + index + 1}`)
    //           .setLabel(`${start + index + 1}`)
    //           .setStyle(ButtonStyle.Secondary)
    //       )
    //     );

    //   const components = [itemButtons];
    //   if (currentPage > 0 || (currentPage + 1) * itemsPerPage < shopItems.length) {
    //     components.unshift(row);
    //   }

    //   return components;
    // };

    // await interaction.reply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });

    // const filter = i => i.customId.startsWith('previous') || i.customId.startsWith('next') || i.customId.startsWith('select_') || i.customId === 'buy' || i.customId === 'go_back' || i.customId === 'confirm' || i.customId === 'cancel';
    // const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    const generateEmbed = (page: number) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const items = shopItems.slice(start, end);

      return {
        title: 'Tienda de Ítems',
        description: items.map((item, index) => `**${index + 1}. ${item.premio}**\nCosto: ${item.costo} puntos\nRequisitos: ${item.requisitos} horas\nCódigo: ${item.codigo}`).join('\n\n'),
        footer: { text: `Página ${page + 1} de ${Math.ceil(shopItems.length / itemsPerPage)}` },
      };
    };

    const generateComponents = (page: number) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const items = shopItems.slice(start, end);

      const itemButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          items.map((item, index) =>
            new ButtonBuilder()
              // .setCustomId(`select_${start + index + 1}`)
              .setCustomId(`select_${index}`)
              .setLabel(item.premio)
              .setStyle(ButtonStyle.Primary)
          )
        );

      const navigationButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Siguiente')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((page + 1) * itemsPerPage >= shopItems.length)
        );

      return [itemButtons, navigationButtons];
    };

    await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });

    const filter = i => i.customId.startsWith('select_') || ['previous', 'next', 'confirm', 'cancel'].includes(i.customId);
    
    const collector = interaction.channel.createMessageComponentCollector({ 
      filter, 
      componentType: ComponentType.Button, 
      time: 15000,
    });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'previous') {
          currentPage--;
          await i.update({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });
        } else if (i.customId === 'next') {
          currentPage++;
          await i.update({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });
        } else if (i.customId.startsWith('select_')) {
          const start = currentPage * itemsPerPage;
          const itemIndex = start + parseInt(i.customId.split('_')[1], 10);
        selectedItem = shopItems[itemIndex];
        
        if (!selectedItem) {
          await i.reply({ content: 'El ítem seleccionado ya no está disponible.', flags: MessageFlags.Ephemeral });
          return;
        }

        // Verificar restricciones por roles
      const member = await interaction.guild.members.fetch(i.user.id);
      const userRoles = member.roles.cache;

      if (userRoles.has(roleIds.NO) && selectedItem.codigo === 'GYM001') {
        await i.reply({
          content: '❌ No puedes comprar este ítem porque eres un **Mal Reportador**.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (userRoles.has(roleIds.SNO) || userRoles.has(roleIds.SMNO)) {
        const roleName = userRoles.has(roleIds.SNO) ? 'SNO' : 'SMNO';
        await i.reply({
          content: `❌ No puedes comprar ítems hijo de puta.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
        // Continuar con la selección del ítem
          await i.reply({
            content: `Has seleccionado el ítem: **${selectedItem.premio}**\n**Costo:** ${selectedItem.costo} puntos\n**Requisitos:** ${selectedItem.requisitos} horas\n¿Deseas comprarlo?`,
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('confirm')
                  .setLabel('Confirmar')
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId('cancel')
                  .setLabel('Cancelar')
                  .setStyle(ButtonStyle.Danger)
              ),
            ]
          });
        } else if (i.customId === 'confirm' && selectedItem) {
          const userRef = db.collection('horas_guita').doc(i.user.id);
          const userSnapshot = await userRef.get();
    
          if (!userSnapshot.exists) {
            await i.reply({ content: 'No tienes datos registrados. Por favor, contacta a un administrador.', flags: MessageFlags.Ephemeral });
            return;
          }
    
          const { horas = 0, puntos = 0, porcentaje = 0 } = userSnapshot.data();
    
          // Obtener los roles del usuario
          const member = await interaction.guild.members.fetch(i.user.id);
          const userRoles = member.roles.cache;

          // Definir los ajustes de precio según los roles
          const roleAdjustments = {
            NE: 0.05,   // Aumento del 5%
            E: -0.05,   // Descuento del 5%
            SE: -0.10,  // Descuento del 10%
            GL: -0.15,  // Descuento del 15%
            SI: -0.05,  // Descuento del 5%
            NO: 0.05,   // Aumento del 5%
            SNO: 0.075, // Aumento del 7.5%
            SMNO: 0.10, // Aumento del 10%
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

          // Calcular el ajuste total basado en los roles del usuario
          let totalAdjustment = 0;
          const rolesAfectados = []; // Lista para almacenar los roles que afectaron el precio

          for (const [role, adjustment] of Object.entries(roleAdjustments)) {
            if (userRoles.has(roleIds[role])) {
              totalAdjustment += adjustment;
              const roleName = interaction.guild.roles.cache.get(roleIds[role])?.name; // Obtener el nombre del rol desde Discord
              if (roleName) {
                rolesAfectados.push(roleName); // Agregar el nombre del rol que afectó el precio
              }
            }
          }

          // Calcular el precio ajustado del ítem
          const adjustedPrice = Math.round(selectedItem.costo * (1 + totalAdjustment));

          const razones = [];
          if (horas < selectedItem.requisitos) {
            razones.push(`No tienes suficientes horas. Requiere: ${selectedItem.requisitos}, tienes: ${horas}.`);
          }
          if (puntos < adjustedPrice) {
            razones.push(`No tienes suficientes puntos. Requiere: ${selectedItem.costo}, tienes: ${puntos}.`);
          }
    
          if (razones.length > 0) {
            await i.reply({ content: `No puedes comprar este ítem por las siguientes razones:\n- ${razones.join('\n- ')}\n\n*(Espera 10 segundos antes de volver a usar el comando)*`, flags: MessageFlags.Ephemeral });
          } else {
            // Descontar solo los puntos del usuario
            const puntosRestantes = puntos - adjustedPrice;
            await userRef.update({
              puntos: puntosRestantes,
            });

            // Registrar la compra en la colección "horas_guita"
            const purchaseDate = new Date();
            const formattedDate = purchaseDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); // Formato DD-MM-YYYY

            // Agregar la compra al campo "compras" como un array de objetos
            await userRef.update({
              compras: FieldValue.arrayUnion({
                codigo: selectedItem.codigo,
                fecha: formattedDate,
              }),
            });

            // Crear un mensaje con los roles que afectaron el precio
            const rolesMensaje = rolesAfectados.length > 0
              ? `Costo ajustado por los roles *${rolesAfectados.join(', ')}*`
              : 'No se aplicaron ajustes de roles.';


            // Si el ítem comprado es "AUM001", aumentar el porcentaje en un 5%
            if (selectedItem.codigo === 'AUM001') {
              const nuevoPorcentaje = Math.min(100, porcentaje + 5); // Asegurarse de que no supere el 100%
              await userRef.update({ porcentaje: nuevoPorcentaje });

              await i.reply({
                content: `¡Has comprado el ítem **${selectedItem.premio}** con éxito!\nTu porcentaje ha aumentado en un **5%** y ahora es **${nuevoPorcentaje}%**.\nCosto ajustado: **${adjustedPrice} puntos**.\n${rolesMensaje}\nTe quedan **${puntosRestantes} puntos**.\n\n*(Espera 10 segundos antes de volver a usar el comando)*`,
              });
            } else {
              await i.reply({
                content: `¡Has comprado el ítem **${selectedItem.premio}** con éxito!\nCosto ajustado: **${adjustedPrice} puntos**.\n${rolesMensaje}\nTe quedan **${puntosRestantes} puntos**.\n\n*(Espera 10 segundos antes de volver a usar el comando)*`,
              });
            }

           // await i.reply({ content: `¡Has comprado el ítem **${selectedItem.premio}** con éxito!\nCosto ajustado: **${adjustedPrice} puntos**.\n${rolesMensaje}\nTe quedan **${puntosRestantes} puntos**.\n\n*(Espera 10 segundos antes de volver a usar el comando)*`});
            
            // Actualizar la tienda (sin eliminar el ítem)
            await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: generateComponents(currentPage) });}
        } else if (i.customId === 'cancel') {
          selectedItem = null; // Reiniciar el estado del ítem seleccionado
          await i.reply({ content: 'Has cancelado la compra.\n\n*(Espera 10 segundos antes de volver a usar el comando)*', flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
          console.error('Error en el collector:', error);
          await i.reply({ content: 'Hubo un error al procesar tu interacción.', flags: MessageFlags.Ephemeral });
        }
      });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] }); // Deshabilitar botones al finalizar
      } catch (error) {
        console.error('Error al deshabilitar botones:', error);
      }
    });

  } catch (error) {
    console.error('Error en el comando shop:', error);
    await interaction.reply({ content: 'There was an error displaying the shop.', flags: MessageFlags.Ephemeral });
  }
}
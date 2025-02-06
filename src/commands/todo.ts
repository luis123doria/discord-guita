import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../firebase';
import schedule from 'node-schedule';

export const data = new SlashCommandBuilder()
  .setName('todo')
  .setDescription('Crea un nuevo To-do con un tiempo de trabajo determinada.')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nombre del to-do (máx 30 carácteres)')
      .setRequired(true)
      .setMaxLength(30))
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Tiempo de trabajo del To-do (formato: HH:MM)')
      .setRequired(true)
      .setMaxLength(5))
  .addUserOption(option =>
  option.setName('user1')
      .setDescription('1er usuario asignado al To-do')
      .setRequired(true))
  .addUserOption(option =>
  option.setName('user2')
      .setDescription('2do usuario asignado al To-do')
      .setRequired(false))
  .addUserOption(option =>
  option.setName('user3')
      .setDescription('3er usuario asignado al To-do')
      .setRequired(false))
  .addUserOption(option =>
  option.setName('user4')
      .setDescription('4to usuario asignado al To-do')
      .setRequired(false));

export async function execute(interaction: CommandInteraction) {
  const todoName = interaction.options.get('name')?.value as string;
  const duration = interaction.options.get('duration')?.value as string;
  const user = interaction.user;


  const usersInvolved: User[] = [];
  for (let i = 1; i <= 5; i++) {
    const userOption = interaction.options.getUser(`user${i}`);
    if (userOption) {
      usersInvolved.push(userOption);
    }
  }

  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: 'Este comando solo se puede usar en canales.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Nuevo To-do creado')
    .addFields(
        { name: '✏️ Nombre', value: todoName, inline: true },
        { name: '⏰ Tiempo de trabajo', value: duration, inline: true },
        { name: '👥 Asignado a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n'), inline: true },
        { name: '📌 Estado', value: 'Backlog', inline: true } // Add status field with default value
      )
    .setColor('#AA2299')
    .setTimestamp();

  try {
    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    // Store todo information in Firestore
    await db.collection('todo').add({
      name: todoName,
      duration: duration,
      createdBy: user.tag,
      assignedTo: usersInvolved.map(u => u.tag),
      status: 'Backlog',
      createdAt: new Date()
    });

        // Schedule a message to be sent 1 hour and 25 minutes before the deadline
        // const deadlineDate = new Date(deadline.split('-').reverse().join('-') + 'T00:00:00');
        // const reminderDate = new Date(deadlineDate.getTime() - (2 * 60 * 60 * 1000 + 0 * 60 * 1000)); // 2 hour and 0 minutes before midnight

        // schedule.scheduleJob(reminderDate, async () => {
        //   await thread.send(`🚨 **Atención** ${usersInvolved.map(u => `<@${u.id}>`).join(', ')} 🚨\nLa fecha límite para la tarea **${taskName}** está a punto de completarse. **¡Dense prisa!**`);
        // });

    await interaction.followUp(`✅ **To-do creado:**`);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Ocurrió un error al crear el To-do.', ephemeral: true });
  }
}
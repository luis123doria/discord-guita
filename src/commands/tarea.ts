import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../firebase';

export const data = new SlashCommandBuilder()
  .setName('tarea')
  .setDescription('Crea una nueva tarea con fecha límite y duración.')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nombre de la tarea (máx 20 carácteres)')
      .setRequired(true)
      .setMaxLength(20))
  .addStringOption(option =>
    option.setName('deadline')
      .setDescription('La fecha límite de la tarea (formato: DD-MM-YYYY)')
      .setRequired(true)
      .setMaxLength(10))
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duración de la tarea (formato HH:MM)')
      .setRequired(true)
      .setMaxLength(5))
    .addUserOption(option =>
    option.setName('user1')
        .setDescription('1er usuario asignado a la tarea')
        .setRequired(true))
    .addUserOption(option =>
    option.setName('user2')
        .setDescription('2do usuario asignado a la tarea')
        .setRequired(false))
    .addUserOption(option =>
    option.setName('user3')
        .setDescription('3er usuario asignado a la tarea')
        .setRequired(false))
    .addUserOption(option =>
    option.setName('user4')
        .setDescription('4to usuario asignado a la tarea')
        .setRequired(false));

export async function execute(interaction: CommandInteraction) {
  const taskName = interaction.options.get('name')?.value as string;
  const deadline = interaction.options.get('deadline')?.value as string;
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
    .setTitle('📝 Nueva tarea creada')
    .addFields(
        { name: '✏️ Nombre', value: taskName, inline: true },
        { name: '📅 Fecha Límite', value: deadline, inline: true },
        { name: '⏲️ Duración', value: duration, inline: true },
        { name: '👥 Asignada a:', value: usersInvolved.map(u => `• ${u.tag}`).join('\n'), inline: true }
      )
    .setColor('#00FF00')
    .setTimestamp();

  try {
    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    const thread = await interaction.channel.threads.create({
      name: `task.${taskName}`,
      autoArchiveDuration: 1440, // Auto-archive after 60 minutes of inactivity
      startMessage: message.id,
      reason: 'New task thread created by bot command'
    });

    // Store task information in Firestore
    await db.collection('tasks').add({
      name: taskName,
      deadline: deadline,
      duration: duration,
      createdBy: user.tag,
      assignedTo: usersInvolved.map(u => u.tag),
      threadId: thread.id,
      createdAt: new Date()
    });

    // Send a message in the new thread mentioning all users involved
    await thread.send(`Tarea asignada a: ${usersInvolved.map(u => `<@${u.id}>`).join(', ')}`);

    await interaction.followUp(`Hilo de seguimiento creado: <#${thread.id}>`);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Ocurrió un error al crear la tarea.', ephemeral: true });
  }
}
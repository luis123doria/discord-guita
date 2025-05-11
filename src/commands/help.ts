import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, EmbedBuilder } from "discord.js"; // Asegúrate de importar EmbedBuilder correctamente

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Abre el menu de ayuda del bot')

    export async function execute(interaction: CommandInteraction) {
        // Lista de comandos y sus descripciones
        const commands = {
            "Gestión de Tareas": [
                { name: '/tarea', description: 'Crea una nueva tarea con fecha límite.' },
                { name: '/todo', description: 'Muestra una lista con todas las tareas.' },
                { name: '/pause', description: 'Pausa o reanuda una tarea. (🧵)' },
                { name: '/finish', description: 'Marca como finalizada una tarea. (🧵)' },
            ],
            "Reportes": [
                { name: '/horas', description: 'Añade horas de trabajo al usuario. Necesita la aprobación de todos los miembros.' },
                { name: '/reporte', description: 'Guarda el reporte diario del usuario.' },
                { name: '/rank', description: 'Muestra el ranking los mejores guiteros.' },
            ],
            "Economía": [
                { name: '/shop', description: 'Muestra la tienda de objetos.' },
                { name: '/gift', description: 'Envía un regalo a otro usuario.' },
            ],
            "Otros": [
                { name: '/fetch', description: 'Actualiza la información de Google Sheets y la guarda en Firebase.' },
                { name: '/update', description: 'Actualiza la información de Firebase y la guarda en Google Sheets.' },
                { name: '/help', description: 'Muestra este mensaje.' },
                { name: '/ping', description: 'Verifica la conexión con el bot.' },
            ],
        };
      
        // Crear el embed
        const embed = new EmbedBuilder()
        .setTitle('📋 Lista de Comandos')
        .setColor('#00AAFF') // Color del embed

        // Agregar campos al embed para cada categoría
        for (const [category, cmds] of Object.entries(commands)) {
        const cmdsList = cmds.map(cmd => `\`${cmd.name}\`: ${cmd.description}`).join('\n');
        embed.addFields({ name: category, value: cmdsList, inline: false });
        }

        // Responder al usuario con el embed
        await interaction.reply({
        embeds: [embed],
        });
    }
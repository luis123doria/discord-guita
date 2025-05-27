import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Client } from 'discord.js';
import { db } from '../firebase';
import { MessageFlags } from 'discord.js';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
const SPREADSHEET_ID = '1h9VoTs0TL57jfCxcenox2DjtCgyGHCDjknHjWIzTaEg'; // ID de tu Google Sheets

async function updateSheetData(sheetName: string, range: string, values: any[][]) {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/guita-bot-51b73329480b.json', // Ruta al archivo de credenciales
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: values,
    },
  });
}

// function flattenData(data: any[]): string[][] {
//       return data.map(doc => {
//         if (typeof doc === 'object' && !Array.isArray(doc)) {
//           return Object.values(doc).map(value => (typeof value === 'object' ? JSON.stringify(value) : value)); // Convierte los objetos en arreglos de valores
//         }
//         return [doc]; // Si no es un objeto, lo envuelve en un arreglo
//       });
//     }

export const data = new SlashCommandBuilder()
  .setName('update')
  .setDescription('Envía la información de Discord a Google Sheets.');

export async function execute(interaction: CommandInteraction, client: Client) {
  try {
    await interaction.reply({ content: 'Procesando la transferencia de datos...', lags: MessageFlags.Ephemeral });

    // IDs de los documentos en la colección horas_guita
    const documentMap = {
      A: { id: '1193666664227688618', targetSheet: 'LUISFER' },
      B: { id: '1326578194974769152', targetSheet: 'ABRAHAM' },
      C: { id: '405132172236685312', targetSheet: 'ANGEL' },
    };

    // Iterar sobre cada documento y procesar los datos
    for (const [key, { id, targetSheet }] of Object.entries(documentMap)) {
      const docRef = db.collection('horas_guita').doc(id);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        console.warn(`El documento con ID ${id} no existe en la colección horas_guita.`);
        continue;
      }

      const { horas, puntos, compras, globalNE, globalE, globalSE, globalGL } = docSnapshot.data() || {};

      if (!Array.isArray(compras) || compras.length === 0 || horas === undefined || puntos === undefined) {
        console.warn(`El documento con ID ${id} no contiene los campos "horas" o "puntos".`);
        continue;
      }

      // Escribir los valores de puntos y horas en las celdas D2 y E2
      const values = [[puntos, horas]];
      const valuesC = compras.map((compra: { fecha: string; codigo: string }) => [compra.fecha, compra.codigo]);

      console.log(`Datos a enviar a Google Sheets (${targetSheet}):`, values, valuesC);

      await updateSheetData(targetSheet, 'D2:E2', values);

      // Escribir los valores en las columnas A y B, comenzando desde la fila 2
      await updateSheetData(targetSheet, 'A2:B2' + (values.length + 1), valuesC);
      
      // Escribir los valores de globalNE, globalE, globalSE, globalGL en las celdas G2:I2
      const globalValues = [[globalNE || 0, globalE || 0, globalSE || 0, globalGL || 0]];
      await updateSheetData(targetSheet, 'G2:J2', globalValues);
      
      console.log(`Datos de la colección ${targetSheet} actualizados en Google Sheets.`);
    }

    await interaction.editReply({ content: 'La transferencia de datos se ha completado con éxito.' });
  } catch (error) {
    console.error('Error al transferir datos:', error);
    await interaction.editReply({ content: 'Hubo un error al transferir los datos. Por favor, revisa los logs.' });
  }
}
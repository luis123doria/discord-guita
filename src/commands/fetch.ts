import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Client } from 'discord.js';
import { google } from 'googleapis';
import { db } from '../firebase';
import { MessageFlags } from 'discord.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
const SPREADSHEET_ID = '1h9VoTs0TL57jfCxcenox2DjtCgyGHCDjknHjWIzTaEg'; // ID de tu Google Sheets

export async function fetchSheetData(sheetName: string, range: string) {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/guita-bot-51b73329480b.json', // Ruta al archivo de credenciales
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });

  return response.data.values || [];
}

function processSheetData(data: string[][]): Record<string, string>[] {
      if (data.length === 0) return [];
    
      const headers = data[0]; // La primera fila contiene los encabezados
      const rows = data.slice(1); // Las filas restantes contienen los datos
    
      return rows.map(row => {
        const processedRow: Record<string, string> = {};
        row.forEach((value, index) => {
          processedRow[headers[index]] = value || ''; // Asigna valores a las claves
        });
        return processedRow;
      });
}

export const data = new SlashCommandBuilder()
  .setName('fetch')
  .setDescription('Actualiza la información de Google Sheets y la guarda en Firebase.');

export async function execute(interaction: CommandInteraction, client: Client) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Extraer datos de la hoja BENEFICIOS
    const beneficiosData = await fetchSheetData('BENEFICIOS', 'A1:D6');
    const processedBeneficiosData = processSheetData(beneficiosData);
    const beneficiosRef = db.collection('BENEFICIOS');
    await beneficiosRef.doc('data').set({ rows: processedBeneficiosData });

    // Extraer y procesar datos de Abraham
    const abrahamData = await fetchSheetData('ABRAHAM', 'A1:B31');
    const abrahamExtraData = await fetchSheetData('ABRAHAM', 'D1:E2');
    const abrahamAdditionalData = await fetchSheetData('ABRAHAM', 'G1:J2'); // Nuevo rango
    
    const processedAbrahamData = processSheetData(abrahamData);
    const processedAbrahamExtraData = processSheetData(abrahamExtraData);
    const processedAbrahamAdditionalData = processSheetData(abrahamAdditionalData); // Procesar nuevo rango
    
    const abrahamRef = db.collection('ABRAHAM');
    await abrahamRef.doc('data').set({ 
      rows: processedAbrahamData, 
      extra: processedAbrahamExtraData,
      additional: processedAbrahamAdditionalData, // Guardar nuevo rango 
    });

    
    // Extraer y procesar datos de Luisfer
    const luisferData = await fetchSheetData('LUISFER', 'A1:B31');
    const luisferExtraData = await fetchSheetData('LUISFER', 'D1:E2');
    const luisferAdditionalData = await fetchSheetData('LUISFER', 'G1:J2'); // Nuevo rango
    
    const processedLuisferData = processSheetData(luisferData);
    const processedLuisferExtraData = processSheetData(luisferExtraData);
    const processedLuisferAdditionalData = processSheetData(luisferAdditionalData); // Procesar nuevo rango
    
    const luisferRef = db.collection('LUISFER');
    await luisferRef.doc('data').set({ 
      rows: processedLuisferData, 
      extra: processedLuisferExtraData,
      additional: processedLuisferAdditionalData, // Guardar nuevo rango
    });

    
    // Extraer y procesar datos de Angel
    const angelData = await fetchSheetData('ANGEL', 'A1:B31');
    const angelExtraData = await fetchSheetData('ANGEL', 'D1:E2');
    const angelAdditionalData = await fetchSheetData('ANGEL', 'G1:J2'); // Nuevo rango
    
    const processedAngelData = processSheetData(angelData);
    const processedAngelExtraData = processSheetData(angelExtraData);
    const processedAngelAdditionalData = processSheetData(angelAdditionalData); // Procesar nuevo rango
    
    const angelRef = db.collection('ANGEL');
    await angelRef.doc('data').set({ 
      rows: processedAngelData, 
      extra: processedAngelExtraData,
      additional: processedAngelAdditionalData, // Guardar nuevo rango
    });

    // Actualizar la colección horas_guita con los datos extra
    const horasGuitaRef = db.collection('horas_guita');

    // Actualizar datos de Abraham (B)
    if (processedAbrahamExtraData.length > 0) {
      const abrahamHoras = parseFloat(processedAbrahamExtraData[0]?.HORAS) || 0;
      const abrahamPuntos = parseFloat(processedAbrahamExtraData[0]?.PUNTOS) || 0;
      const abrahamGlobalNE = parseFloat(processedAbrahamAdditionalData[0]?.['NO EFECTIVO']) || 0;
      const abrahamGlobalE = parseFloat(processedAbrahamAdditionalData[0]?.['EFECTIVO']) || 0;
      const abrahamGlobalSE = parseFloat(processedAbrahamAdditionalData[0]?.['SUPEL ELEGANTE']) || 0;
      const abrahamGlobalGL = parseFloat(processedAbrahamAdditionalData[0]?.['GUITA LOVER']) || 0;
      
      await horasGuitaRef.doc("1326578194974769152").set(
        { 
          horas: abrahamHoras, 
          puntos: abrahamPuntos,
          globalNE: abrahamGlobalNE,
          globalE: abrahamGlobalE,
          globalSE: abrahamGlobalSE,
          globalGL: abrahamGlobalGL
        },
        { merge: true }
      );
    }

    // Actualizar datos de Luisfer (A)
    if (processedLuisferExtraData.length > 0) {
      const luisferHoras = parseFloat(processedLuisferExtraData[0]?.HORAS) || 0;
      const luisferPuntos = parseFloat(processedLuisferExtraData[0]?.PUNTOS) || 0;
      const luisferGlobalNE = parseFloat(processedLuisferAdditionalData[0]?.['NO EFECTIVO']) || 0;
      const luisferGlobalE = parseFloat(processedLuisferAdditionalData[0]?.['EFECTIVO']) || 0;
      const luisferGlobalSE = parseFloat(processedLuisferAdditionalData[0]?.['SUPEL ELEGANTE']) || 0;
      const luisferGlobalGL = parseFloat(processedLuisferAdditionalData[0]?.['GUITA LOVER']) || 0;
      
      await horasGuitaRef.doc("1193666664227688618").set(
        { 
          horas: luisferHoras, 
          puntos: luisferPuntos,
          globalNE: luisferGlobalNE,
          globalE: luisferGlobalE,
          globalSE: luisferGlobalSE,
          globalGL: luisferGlobalGL
        },
        { merge: true }
      );
    }

    // Actualizar datos de Angel (C)
    if (processedAngelExtraData.length > 0) {
      const angelHoras = parseFloat(processedAngelExtraData[0]?.HORAS) || 0;
      const angelPuntos = parseFloat(processedAngelExtraData[0]?.PUNTOS) || 0;
      const angelGlobalNE = parseFloat(processedAngelAdditionalData[0]?.['NO EFECTIVO']) || 0;
      const angelGlobalE = parseFloat(processedAngelAdditionalData[0]?.['EFECTIVO']) || 0;
      const angelGlobalSE = parseFloat(processedAngelAdditionalData[0]?.['SUPEL ELEGANTE']) || 0;
      const angelGlobalGL = parseFloat(processedAngelAdditionalData[0]?.['GUITA LOVER']) || 0;

      await horasGuitaRef.doc("405132172236685312").set(
        { 
          horas: angelHoras, 
          puntos: angelPuntos,
          globalNE: angelGlobalNE,
          globalE: angelGlobalE,
          globalSE: angelGlobalSE,
          globalGL: angelGlobalGL
        },
        { merge: true }
      );
    }

    await interaction.editReply({ content: 'La información ha sido actualizada y guardada en Firebase.' });
  } catch (error) {
    console.error('Error actualizando información desde Google Sheets:', error);
    await interaction.editReply({ content: 'Hubo un error al actualizar la información. Por favor, revisa los logs.' });
  }
}
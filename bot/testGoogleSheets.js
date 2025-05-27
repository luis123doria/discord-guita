import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
const SPREADSHEET_ID = '1h9VoTs0TL57jfCxcenox2DjtCgyGHCDjknHjWIzTaEg'; // Reemplaza con el ID de tu Google Sheets
const RANGE = 'A1:D6'; // Rango de prueba

async function testGoogleSheetsAccess() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials/guita-bot-51b73329480b.json', // Ruta al archivo de credenciales
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    console.log('Datos obtenidos de Google Sheets:', response.data.values);
  } catch (error) {
    console.error('Error al acceder a Google Sheets:', error);
  }
}

testGoogleSheetsAccess();
import * as XLSX from 'xlsx';

export interface ParsedRecipient {
  raw: string;
  digits: string;
  chatId: string;
  name?: string;
  variables: Record<string, string>;
  validFormat: boolean;
  duplicate: boolean;
}

export interface ValidationSummary {
  totalImported: number;
  validFormatCount: number;
  invalidFormatCount: number;
  duplicateCount: number;
  uniqueRecipients: ParsedRecipient[];
  invalidRecipients: ParsedRecipient[];
  duplicateRecipients: ParsedRecipient[];
}

export interface ParsedWorkbookResult {
  sheetNames: string[];
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Normalize raw input string into E.164 phone digits (8–15 digits)
 */
export function normalizePhoneDigits(input: string): string {
  if (!input) return '';
  return String(input).replace(/[^0-9]/g, '');
}

/**
 * Validate phone number format (between 8 and 15 digits)
 */
export function isValidPhoneFormat(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Parse manual text input (newline, comma, semicolon delimited)
 */
export function parseManualRecipients(input: string): ValidationSummary {
  const lines = input
    .split(/[\n,;]+/)
    .map(line => line.trim())
    .filter(Boolean);

  const seenDigits = new Set<string>();
  const allParsed: ParsedRecipient[] = [];
  const uniqueRecipients: ParsedRecipient[] = [];
  const invalidRecipients: ParsedRecipient[] = [];
  const duplicateRecipients: ParsedRecipient[] = [];

  for (const raw of lines) {
    const digits = normalizePhoneDigits(raw);
    const validFormat = isValidPhoneFormat(digits);
    const duplicate = validFormat && seenDigits.has(digits);

    const parsed: ParsedRecipient = {
      raw,
      digits,
      chatId: `${digits}@c.us`,
      variables: { phone: digits },
      validFormat,
      duplicate,
    };

    allParsed.push(parsed);

    if (!validFormat) {
      invalidRecipients.push(parsed);
    } else if (duplicate) {
      duplicateRecipients.push(parsed);
    } else {
      seenDigits.add(digits);
      uniqueRecipients.push(parsed);
    }
  }

  return {
    totalImported: allParsed.length,
    validFormatCount: uniqueRecipients.length,
    invalidFormatCount: invalidRecipients.length,
    duplicateCount: duplicateRecipients.length,
    uniqueRecipients,
    invalidRecipients,
    duplicateRecipients,
  };
}

/**
 * Parse uploaded CSV or Excel file locally
 */
export async function parseSpreadsheetFile(file: File, selectedSheet?: string): Promise<ParsedWorkbookResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('The uploaded file does not contain any readable sheets.');
  }

  const sheetName = selectedSheet && sheetNames.includes(selectedSheet) ? selectedSheet : sheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" could not be loaded.`);
  }

  // Convert worksheet to array of objects with raw strings
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false });

  if (rawRows.length === 0) {
    return { sheetNames, headers: [], rows: [] };
  }

  // Extract all unique headers
  const headerSet = new Set<string>();
  rawRows.forEach(row => {
    Object.keys(row).forEach(key => headerSet.add(key.trim()));
  });

  const headers = Array.from(headerSet).filter(Boolean);

  // Normalize row keys to string values
  const rows: Record<string, string>[] = rawRows.map(row => {
    const cleanRow: Record<string, string> = {};
    headers.forEach(h => {
      cleanRow[h] = String(row[h] ?? '').trim();
    });
    return cleanRow;
  });

  return { sheetNames, headers, rows };
}

/**
 * Map structured spreadsheet rows to validated recipients
 */
export function mapRowsToRecipients(
  rows: Record<string, string>[],
  phoneColumn: string,
  nameColumn?: string,
): ValidationSummary {
  const seenDigits = new Set<string>();
  const allParsed: ParsedRecipient[] = [];
  const uniqueRecipients: ParsedRecipient[] = [];
  const invalidRecipients: ParsedRecipient[] = [];
  const duplicateRecipients: ParsedRecipient[] = [];

  for (const row of rows) {
    const rawPhone = row[phoneColumn] || '';
    const digits = normalizePhoneDigits(rawPhone);
    const validFormat = isValidPhoneFormat(digits);
    const duplicate = validFormat && seenDigits.has(digits);

    const name = nameColumn && row[nameColumn] ? row[nameColumn] : undefined;

    // Collect all columns as potential template variables
    const variables: Record<string, string> = { phone: digits };
    if (name) variables.name = name;

    Object.entries(row).forEach(([colName, colVal]) => {
      const cleanKey = colName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (cleanKey && colVal) {
        variables[cleanKey] = colVal;
      }
    });

    const parsed: ParsedRecipient = {
      raw: rawPhone,
      digits,
      chatId: `${digits}@c.us`,
      name,
      variables,
      validFormat,
      duplicate,
    };

    allParsed.push(parsed);

    if (!validFormat) {
      invalidRecipients.push(parsed);
    } else if (duplicate) {
      duplicateRecipients.push(parsed);
    } else {
      seenDigits.add(digits);
      uniqueRecipients.push(parsed);
    }
  }

  return {
    totalImported: allParsed.length,
    validFormatCount: uniqueRecipients.length,
    invalidFormatCount: invalidRecipients.length,
    duplicateCount: duplicateRecipients.length,
    uniqueRecipients,
    invalidRecipients,
    duplicateRecipients,
  };
}

/**
 * Safe CSV value escaping
 */
export function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Export rows array to CSV file download
 */
export function downloadCsvReport(filename: string, rows: string[][]): void {
  const csvContent = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

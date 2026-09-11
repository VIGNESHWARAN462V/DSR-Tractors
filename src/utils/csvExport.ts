// ========================================================
// Client-Side CSV Export Utility (File System Access API + Blob Fallback)
// ========================================================

export async function exportCSV(data: any[]) {
  if (!data || data.length === 0) {
    if (typeof alert === 'function') {
      alert('No data available to export');
    }
    return;
  }

  const headers = Object.keys(data[0]);

  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return '';
    return `"${String(value).replace(/"/g, '""')}"`;
  };

  const rows = data.map((item) =>
    headers.map((header) => escapeCSV(item[header])).join(',')
  );

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  // Preferred method: File System Access API
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: 'DSR-Report.csv',
        types: [
          {
            description: 'CSV File',
            accept: {
              'text/csv': ['.csv'],
            },
          },
        ],
      });

      const writable = await fileHandle.createWritable();

      await writable.write(
        new Blob([csvContent], {
          type: 'text/csv;charset=utf-8',
        })
      );

      await writable.close();

      return;
    } catch (error: any) {
      // User cancelled save dialog
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('File save failed:', error);
    }
  }

  // Fallback for browsers without File System Access API
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;
  link.download = 'DSR-Report.csv';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// Backward compatibility aliases
export const downloadCSV = exportCSV;
export const escapeCSVValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
};
export const escapeCSVField = escapeCSVValue;

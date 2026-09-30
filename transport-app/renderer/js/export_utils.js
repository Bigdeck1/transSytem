/**
 * Shared utility for exporting JSON data to CSV and triggering a download.
 * All field values are quoted to handle commas, newlines, and special characters.
 */
window.exportToCSV = function(filename, rows) {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }

  // 1. Extract headers (keys from the first object)
  const headers = Object.keys(rows[0]);
  
  // 2. Build CSV string — wrap ALL values in quotes for safety
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","), // header row
    ...rows.map(row => 
      headers.map(fieldName => {
        let value = row[fieldName] ?? "";
        // Wrap all values in quotes and escape internal quotes
        value = `"${String(value).replace(/"/g, '""')}"`;
        return value;
      }).join(",")
    )
  ].join("\r\n");

  // 3. Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

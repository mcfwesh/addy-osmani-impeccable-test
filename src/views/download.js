// Save text as a file on this device. No network: the file is built in memory.
export function downloadText(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari needs a moment before the URL can be freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

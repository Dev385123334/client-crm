export function parseSheetUrl(url) {
  if (/\/pub/.test(url)) {
    const m = url.match(/\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (m) return { id: m[1], type: 'published' };
  }
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { id: m[1], type: 'regular' };
  return null;
}

export function extractSheetId(url) {
  const info = parseSheetUrl(url);
  return info ? info.id : null;
}

export function resolveSheetUrl(url, gid) {
  if (gid != null && /\/pub\?/.test(url)) {
    return url + `&gid=${gid}`;
  }
  if (/\/pub\?/.test(url) || /\/pub$/.test(url)) return url;
  if (/\/export\?/.test(url) && gid == null) return url;
  const info = parseSheetUrl(url);
  if (!info) return null;
  let exportUrl = `https://docs.google.com/spreadsheets/d/${info.id}/export?format=csv`;
  if (gid != null) exportUrl += `&gid=${gid}`;
  return exportUrl;
}

export async function fetchSheetTabs(spreadsheetId, apiKey) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Google Sheets API returned 403. Make sure the sheet is shared with "Anyone with the link" (File → Share → Anyone with the link → Viewer).');
    }
    const body = await res.text().catch(() => '');
    throw new Error(`Sheets API error (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  return (data.sheets || []).map(s => ({
    title: s.properties.title,
    gid: s.properties.sheetId
  }));
}

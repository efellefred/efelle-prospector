export function fmt(n) { return '$' + Number(n).toLocaleString(); }

export async function fetchImageAsDataURI(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch(e) { return null; }
}

export async function inlineImages(html) {
  const imgRegex = /src="(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp|svg))"/gi;
  const urls = [];
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  const dataURIs = await Promise.all(urls.map(fetchImageAsDataURI));
  urls.forEach((url, i) => {
    if (dataURIs[i]) {
      html = html.split('src="' + url + '"').join('src="' + dataURIs[i] + '"');
    }
  });
  return html;
}

export async function writeToFrame(frameEl, html) {
  const inlined = await inlineImages(html);
  frameEl.srcdoc = inlined;
}

// Attach to window for onclick compatibility
window.fmt = fmt;
window.fetchImageAsDataURI = fetchImageAsDataURI;
window.inlineImages = inlineImages;
window.writeToFrame = writeToFrame;

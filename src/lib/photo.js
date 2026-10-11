// 照片在手機上先縮小、轉 JPEG 再存 Firestore（免費方案的新專案不能開 Storage）
// Firestore 一份文件上限 1 MiB，所以大圖控制在 900 KB 以內

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // 舊瀏覽器不支援選項，改用 <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(img, max) {
  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export const PHOTO_MAX_CHARS = 900_000;

export async function compressPhoto(file) {
  const img = await loadImage(file);
  let full = '';
  for (const [max, q] of [[1080, 0.72], [900, 0.6], [720, 0.5], [560, 0.45]]) {
    full = draw(img, max).toDataURL('image/jpeg', q);
    if (full.length <= PHOTO_MAX_CHARS) break;
  }
  const thumb = draw(img, 240).toDataURL('image/jpeg', 0.6);
  img.close?.();
  return { full, thumb };
}

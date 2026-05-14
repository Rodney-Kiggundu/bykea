/**
 * Read an image file and return a JPEG data URL (resized, compressed) for inline preview / state.
 * @param {File} file
 * @param {number} maxEdge longest side in px
 * @param {number} quality 0–1 for JPEG
 */
export function compressImageToDataUrl(file, maxEdge = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      const longest = Math.max(width, height);
      const scale = longest > maxEdge ? maxEdge / longest : 1;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Could not read this image.'));
    };
    img.src = objUrl;
  });
}

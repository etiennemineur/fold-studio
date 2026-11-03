import type { ArtworkLayer } from './useArtworkLayers';

/** Flatten a rotated image for pdfMake, which does not rotate image nodes.
 * Geometry remains in millimetres; only the image itself is rasterized. */
export async function preparePdfArtwork(layer: ArtworkLayer, source: string) {
  const angle = ((layer.rotation % 360) + 360) % 360;
  if (!angle) return { source, x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  const radians = angle * Math.PI / 180;
  const width = Math.abs(layer.width * Math.cos(radians)) + Math.abs(layer.height * Math.sin(radians));
  const height = Math.abs(layer.width * Math.sin(radians)) + Math.abs(layer.height * Math.cos(radians));
  if (![width, height].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid artwork dimensions.');
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Artwork could not be decoded for PDF export.'));
    img.src = source;
  });
  const canvas = document.createElement('canvas');
  const scale = Math.min(300 / 25.4, 4096 / Math.max(width, height));
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF artwork canvas is unavailable.');
  context.scale(canvas.width / width, canvas.height / height);
  context.translate(width / 2, height / 2);
  context.rotate(radians);
  context.drawImage(image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  return { source: canvas.toDataURL('image/png'), x: layer.x + (layer.width - width) / 2, y: layer.y + (layer.height - height) / 2, width, height };
}

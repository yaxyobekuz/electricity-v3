/*
 * Rasmni serverga yuborishdan oldin brauzerda kichraytirish: telefon rasmi
 * (4-8 MB, ~4000px) -> eng uzun tomoni 1600px, JPEG 85% (odatda 0,2-0,6 MB).
 * Faqat mijozda chaqiriladi (canvas). EXIF bo'yicha burilish
 * `createImageBitmap` da hisobga olinadi.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.85;

/**
 * Kichraytirilgan JPEG; brauzer ocholmagan fayl (masalan HEIC) yoki
 * kichraytirish foyda bermasa - faylning o'zi (turini server tekshiradi).
 */
export async function shrinkImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  // Shaffof PNG qismlari JPEG da qora bo'lib qolmasin.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  // Kichik rasm qayta siqilganda kattalashishi mumkin - unda asli yuboriladi.
  return blob && blob.size < file.size ? blob : file;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_MB = 5;
const MAX_DIMENSION = 1800;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Тек JPG, PNG немесе WebP форматындағы суреттер қабылданады";
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `Файл көлемі ${MAX_UPLOAD_MB} МБ-тан аспауы керек (қазір ${(file.size / 1024 / 1024).toFixed(1)} МБ)`;
  }
  return null;
}

/**
 * Үлкен суреттерді браузерде оңтайландыру: ең үлкен жағы 1800px, WebP форматы.
 * Нәтиже түпнұсқадан үлкен болса — түпнұсқа қайтарылады.
 */
export async function optimizeImage(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  const original = { blob: file as Blob, type: file.type, ext: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg" };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) {
      bitmap.close();
      return original;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#ffffff"; // мөлдір PNG үшін ақ фон
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return original;
    return { blob, type: "image/webp", ext: "webp" };
  } catch {
    return original;
  }
}

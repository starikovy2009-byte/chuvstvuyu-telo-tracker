const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Файл не похож на корректное изображение"));
    image.src = source;
  });
}

export async function prepareAvatar(file) {
  if (!file) return null;
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Выберите изображение JPEG, PNG или WebP");
  if (file.size > MAX_FILE_SIZE) throw new Error("Фотография должна быть не больше 8 МБ");
  const source = await readFile(file);
  const image = await loadImage(source);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - side) / 2;
  const sourceY = (image.naturalHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#f4f2ee";
  context.fillRect(0, 0, 512, 512);
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);
  const webp = canvas.toDataURL("image/webp", .82);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", .84);
}

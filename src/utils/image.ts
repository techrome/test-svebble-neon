export const createImage = async (file: File): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image failed to load"));

      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

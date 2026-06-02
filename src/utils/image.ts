export const getImageDimensions = (
  file: File,
): Promise<{ w: number; h: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.src = URL.createObjectURL(file);
  });
};

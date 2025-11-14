/**
 * Utility functions for image handling
 */

/**
 * Get all images from Front, Back, and Machine folders
 * @returns {string[]} Array of image paths
 */
export const getFrontFolderImages = () => {
  const images = [
    // Front folder (4 images)
    "public/images/content/Front/Andy.jpg",
    "public/images/content/Front/Emily.jpg",
    "public/images/content/Front/Troy.png",
    "public/images/content/Front/Weihao.jpg",
    // Back folder (2 images)
    "public/images/content/Back/Daniel G.jpg",
    "public/images/content/Back/Marco.jpg",
    // Machine folder (3 images)
    "public/images/content/Machine/Daniel H.jpg",
    "public/images/content/Machine/Josh.png",
    "public/images/content/Machine/Rizza.jpg",
  ];
  return images;
};

/**
 * Convert a single image URL or array of URLs to an array
 * @param {string | string[] | null} src - Single URL, array of URLs, or null
 * @returns {string[]} Array of image URLs
 */
export const normalizeImageSources = (src) => {
  if (Array.isArray(src)) {
    return src.filter((s) => s && typeof s === "string");
  }
  if (typeof src === "string" && src.length > 0) {
    return [src];
  }
  return [];
};

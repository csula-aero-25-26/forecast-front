/**
 * Utility functions for image handling
 */

/**
 * Get all images from Front, Back, and Machine folders
 * @returns {string[]} Array of image paths
 */
export const getFrontFolderImages = () => {
  // Use public root paths served by Vite: paths should start with '/images/...'
  const images = [
    "/images/content/Front/Andy.jpg",
    "/images/content/Front/Emily.jpg",
    "/images/content/Front/Troy.png",
    "/images/content/Front/Weihao.jpg",
    "/images/content/Back/Daniel G.jpg",
    "/images/content/Back/Marco.jpg",
    "/images/content/Machine/Daniel H.jpg",
    "/images/content/Machine/Josh.png",
    "/images/content/Machine/Rizza.jpg",
  ];
  return images;
};

/**
 * Convert a single image URL or array of URLs to an array
 * @param {string | string[] | null} src - Single URL, array of URLs, or null
 * @returns {string[]} Array of image URLs
 */
export const normalizeImageSources = (src) => {
  const normalize = (s) => {
    if (typeof s !== "string") return null
    // Convert paths that reference the `public/` folder to the served root.
    // e.g. "public/images/..." -> "/images/..."
    if (s.startsWith("public/")) {
      return s.replace(/^public\//, "/")
    }
    return s
  }

  if (Array.isArray(src)) {
    return src
      .map(normalize)
      .filter((s) => s && typeof s === "string")
  }
  if (typeof src === "string" && src.length > 0) {
    const n = normalize(src)
    return n ? [n] : []
  }
  return [];
};

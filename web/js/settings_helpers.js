/**
 * Pure Logic Helpers for Settings Tab Navigation
 */

/**
 * Computes next section index for roving tabindex keyboard navigation.
 *
 * @param {number} currentIndex
 * @param {number} totalCount
 * @param {string} key
 * @returns {number}
 */
export function getSettingsNextSectionIndex(currentIndex, totalCount, key) {
  if (totalCount <= 0) return 0;
  let next = currentIndex;

  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      next = (currentIndex + 1) % totalCount;
      break;
    case "ArrowUp":
    case "ArrowLeft":
      next = (currentIndex - 1 + totalCount) % totalCount;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = totalCount - 1;
      break;
    default:
      return currentIndex;
  }
  return next;
}

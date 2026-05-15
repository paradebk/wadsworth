/**
 * Builds a URL using the wadsworth-file:// custom protocol so the renderer can
 * load arbitrary local files (e.g. for PDF iframes, image src, QuickLook PNGs).
 * The "local" host segment is a sentinel that prevents Chromium's URL parser
 * from swallowing the leading /Users path into the authority component.
 */
export function toAppFileUrl(path: string): string {
  return 'wadsworth-file://local' + path.split('/').map(encodeURIComponent).join('/')
}

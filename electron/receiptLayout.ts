import type { BrowserWindow } from 'electron'

// Xprinter XP-80TS: 80 mm roll with a 72 mm printable area.
export const RECEIPT_PAGE_WIDTH_MM = 80
export const RECEIPT_CONTENT_WIDTH_MM = 72

// Keep downloaded tickets and direct printing identical, including alignment.
export async function prepareReceiptPage(window: BrowserWindow): Promise<number> {
  return window.webContents.executeJavaScript(`(async () => {
    // Match measurement and layout to the page width exposed by the destination.
    document.body.style.width = '${RECEIPT_PAGE_WIDTH_MM}mm';
    const receipt = document.querySelector('.receipt');
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    receipt.style.marginLeft = 'auto';
    receipt.style.marginRight = 'auto';
    receipt.style.maxWidth = '${RECEIPT_CONTENT_WIDTH_MM}mm';
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
    // Bottom padding already provides space before the cut; allow 1 mm for rounding.
    const height = Math.max(50, Math.ceil(Math.max(receipt.scrollHeight, receipt.getBoundingClientRect().height) * 25.4 / 96) + 1);
    const style = document.createElement('style');
    style.textContent = '@page { size: ${RECEIPT_PAGE_WIDTH_MM}mm ' + height + 'mm; margin: 0; }';
    document.head.appendChild(style);
    return height;
  })()`)
}

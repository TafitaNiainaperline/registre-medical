import type { BrowserWindow } from 'electron'

// The XP-80 "80(72) mm" driver exposes 72 mm for the 80 mm roll.
export const RECEIPT_PAGE_WIDTH_MM = 72

// Keep downloaded tickets and direct printing identical, including alignment.
export async function prepareReceiptPage(window: BrowserWindow): Promise<number> {
  return window.webContents.executeJavaScript(`(async () => {
    // Match measurement and layout to the page width exposed by the destination.
    document.body.style.width = '${RECEIPT_PAGE_WIDTH_MM}mm';
    const receipt = document.querySelector('.receipt');
    // Physical printing uses a fixed origin, even if the dialog changes page width.
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    receipt.style.marginLeft = '0';
    receipt.style.marginRight = '0';
    // Keep the content centered 23 mm from the print origin with safe edge padding.
    receipt.style.maxWidth = '46mm';
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
    const height = Math.max(50, Math.ceil(Math.max(receipt.scrollHeight, receipt.getBoundingClientRect().height) * 25.4 / 96) + 8);
    const style = document.createElement('style');
    style.textContent = '@page { size: ${RECEIPT_PAGE_WIDTH_MM}mm ' + height + 'mm; margin: 0; }';
    document.head.appendChild(style);
    return height;
  })()`)
}

import { BrowserWindow } from 'electron'
import type { PrintResult } from './types'
import { prepareReceiptPage, RECEIPT_PAGE_WIDTH_MM } from './receiptLayout'

export async function printReceipt(html: string, parent?: BrowserWindow): Promise<PrintResult> {
  const ticket = new BrowserWindow({
    show: false,
    ...(parent ? { parent } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  try {
    const printers = await ticket.webContents.getPrintersAsync()
    if (!printers.length) throw new Error('Aucune imprimante installée. Installez le pilote de votre Xprinter dans Windows.')
    await ticket.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const heightMm = await prepareReceiptPage(ticket)
    const thermalPrinter = printers.find((printer) => /xp[-_ ]?80/i.test(printer.name + ' ' + printer.displayName))
      ?? printers.find((printer) => /xprinter/i.test(printer.name + ' ' + printer.displayName))
    return await new Promise<PrintResult>((resolve, reject) => {
      ticket.webContents.print({
        silent: false,
        ...(thermalPrinter ? { deviceName: thermalPrinter.name } : {}),
        color: false,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: RECEIPT_PAGE_WIDTH_MM * 1000, height: heightMm * 1000 },
        scaleFactor: 100,
        copies: 1,
      }, (success, reason) => {
        if (success) resolve({ canceled: false })
        else if (/cancel/i.test(reason)) resolve({ canceled: true })
        else reject(new Error(`Impression impossible. Vérifiez l’imprimante, son pilote et le papier 80 mm dans Windows. ${reason || ''}`))
      })
    })
  } finally {
    ticket.destroy()
  }
}

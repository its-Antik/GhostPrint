/**
 * Pagen Invoice Generator
 * Generates a high-contrast A4 portrait PDF & interactive preview
 * Works entirely client-side — no server dependency
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface InvoiceData {
  orderId: string;
  shortId: string;
  date: string;
  time: string;
  status: string;
  buyerName: string;
  buyerEmail: string;
  runnerName: string;
  runnerEmail: string;
  deliveryLocation: string;
  files: Array<{
    name: string;
    pages: number;
    colorMode: string;
    copies: number;
  }>;
  totalPages: number;
  totalPrice: number;
  // Runner-specific
  baseCost?: number;
  platformFee?: number;
  netEarnings?: number;
  viewerRole: 'buyer' | 'runner';
}

// Generate short order ID from UUID
export function generateShortId(uuid: string): string {
  if (!uuid) return 'PGN-000000';
  const clean = uuid.replace(/-/g, '').toUpperCase();
  return `PGN-${clean.substring(0, 6)}`;
}

// Format currency
function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Generate a standalone A4 Portrait PDF file blob using pdf-lib
 */
export async function createPdfInvoiceBlob(data: InvoiceData): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait dimensions in points
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // High-contrast color definitions
  const black = rgb(0.06, 0.09, 0.16);       // #0f172a (Slate 900)
  const darkGray = rgb(0.2, 0.25, 0.33);     // #334155 (Slate 700)
  const lightBg = rgb(0.97, 0.98, 0.99);     // #f8fafc (Slate 50)
  const borderColor = rgb(0.8, 0.84, 0.88); // #cbd5e1 (Slate 300)
  const blue = rgb(0.01, 0.41, 0.63);       // #0369a1 (Sky 700)
  const green = rgb(0.08, 0.5, 0.24);       // #15803d (Green 700)
  const white = rgb(1, 1, 1);
  const darkHeader = rgb(0.06, 0.09, 0.16);

  let y = height - 50;

  // Header
  page.drawText('PAGEN', { x: 40, y, size: 28, font: fontBold, color: black });
  page.drawText('CAMPUS PRINT NETWORK', { x: 40, y: y - 16, size: 9, font: fontBold, color: darkGray });

  page.drawText('INVOICE', { x: width - 140, y, size: 22, font: fontRegular, color: darkGray });
  page.drawText(data.shortId, { x: width - 140, y: y - 18, size: 12, font: fontBold, color: black });

  y -= 45;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 2, color: black });

  y -= 30;
  // Status & Date
  const statusText = data.status.toUpperCase();
  page.drawRectangle({ x: 40, y: y - 4, width: 100, height: 22, color: rgb(0.9, 0.97, 0.9), borderColor: green, borderWidth: 1 });
  page.drawText(statusText, { x: 52, y: y + 2, size: 10, font: fontBold, color: green });

  page.drawText('DATE:', { x: width - 220, y: y + 5, size: 9, font: fontBold, color: darkGray });
  page.drawText(`${data.date} at ${data.time}`, { x: width - 220, y: y - 8, size: 10, font: fontBold, color: black });

  y -= 45;
  // Buyer & Runner Boxes
  const boxWidth = (width - 96) / 2;
  
  // Buyer Box
  page.drawRectangle({ x: 40, y: y - 55, width: boxWidth, height: 65, color: lightBg, borderColor, borderWidth: 1 });
  page.drawText('BUYER', { x: 52, y: y - 4, size: 8, font: fontBold, color: darkGray });
  page.drawText(data.buyerName.substring(0, 25), { x: 52, y: y - 20, size: 12, font: fontBold, color: black });
  page.drawText(data.buyerEmail.substring(0, 30), { x: 52, y: y - 35, size: 9, font: fontRegular, color: darkGray });

  // Runner Box
  page.drawRectangle({ x: 40 + boxWidth + 16, y: y - 55, width: boxWidth, height: 65, color: lightBg, borderColor, borderWidth: 1 });
  page.drawText('RUNNER', { x: 52 + boxWidth + 16, y: y - 4, size: 8, font: fontBold, color: darkGray });
  page.drawText(data.runnerName.substring(0, 25), { x: 52 + boxWidth + 16, y: y - 20, size: 12, font: fontBold, color: black });
  page.drawText(data.runnerEmail.substring(0, 30), { x: 52 + boxWidth + 16, y: y - 35, size: 9, font: fontRegular, color: darkGray });

  y -= 75;
  // Delivery Location Box
  page.drawRectangle({ x: 40, y: y - 25, width: width - 80, height: 35, color: rgb(0.94, 0.98, 1), borderColor: rgb(0.7, 0.85, 1), borderWidth: 1 });
  page.drawText('DELIVERY LOCATION', { x: 52, y: y - 2, size: 8, font: fontBold, color: blue });
  page.drawText(data.deliveryLocation, { x: 52, y: y - 17, size: 11, font: fontBold, color: blue });

  y -= 45;
  // Table Header
  page.drawText('DOCUMENTS', { x: 40, y, size: 9, font: fontBold, color: darkGray });
  y -= 15;

  const tableWidth = width - 80;
  page.drawRectangle({ x: 40, y: y - 18, width: tableWidth, height: 22, color: darkHeader });
  page.drawText('#', { x: 50, y: y - 13, size: 9, font: fontBold, color: white });
  page.drawText('FILE NAME', { x: 80, y: y - 13, size: 9, font: fontBold, color: white });
  page.drawText('PAGES', { x: width - 200, y: y - 13, size: 9, font: fontBold, color: white });
  page.drawText('MODE', { x: width - 140, y: y - 13, size: 9, font: fontBold, color: white });
  page.drawText('COPIES', { x: width - 80, y: y - 13, size: 9, font: fontBold, color: white });

  y -= 22;
  // File Rows
  data.files.forEach((file, index) => {
    const rowBg = index % 2 === 0 ? white : lightBg;
    page.drawRectangle({ x: 40, y: y - 18, width: tableWidth, height: 22, color: rowBg, borderColor, borderWidth: 0.5 });
    page.drawText(String(index + 1), { x: 50, y: y - 13, size: 9, font: fontRegular, color: black });
    page.drawText(file.name.substring(0, 35), { x: 80, y: y - 13, size: 9, font: fontBold, color: black });
    page.drawText(String(file.pages), { x: width - 190, y: y - 13, size: 9, font: fontRegular, color: black });
    page.drawText(file.colorMode === 'bw' ? 'B&W' : 'Color', { x: width - 140, y: y - 13, size: 9, font: fontRegular, color: black });
    page.drawText(String(file.copies || 1), { x: width - 70, y: y - 13, size: 9, font: fontRegular, color: black });
    y -= 22;
  });

  y -= 20;
  // Summary Box
  const sumWidth = 220;
  page.drawRectangle({ x: width - 40 - sumWidth, y: y - 45, width: sumWidth, height: 55, color: darkHeader });
  page.drawText('TOTAL PAGES:', { x: width - 40 - sumWidth + 15, y: y - 12, size: 9, font: fontBold, color: rgb(0.8, 0.85, 0.9) });
  page.drawText(String(data.totalPages), { x: width - 60, y: y - 12, size: 10, font: fontBold, color: white });

  page.drawLine({ start: { x: width - 40 - sumWidth + 15, y: y - 22 }, end: { x: width - 55, y: y - 22 }, thickness: 1, color: rgb(0.3, 0.35, 0.4) });

  page.drawText('TOTAL AMOUNT:', { x: width - 40 - sumWidth + 15, y: y - 38, size: 9, font: fontBold, color: rgb(0.8, 0.85, 0.9) });
  const priceStr = `Rs. ${data.totalPrice.toFixed(2)}`;
  page.drawText(priceStr, { x: width - 110, y: y - 40, size: 15, font: fontBold, color: rgb(0.98, 0.8, 0.1) });

  y -= 65;

  // Earnings Section for Runner
  if (data.viewerRole === 'runner') {
    page.drawRectangle({ x: 40, y: y - 80, width: tableWidth, height: 90, color: rgb(0.94, 0.99, 0.95), borderColor: green, borderWidth: 1 });
    page.drawText('EARNINGS BREAKDOWN', { x: 52, y: y - 15, size: 9, font: fontBold, color: green });
    
    page.drawText('Total Collected:', { x: 52, y: y - 32, size: 9, font: fontRegular, color: black });
    page.drawText(`Rs. ${data.totalPrice.toFixed(2)}`, { x: width - 120, y: y - 32, size: 9, font: fontBold, color: black });

    page.drawText('Base Print Cost:', { x: 52, y: y - 46, size: 9, font: fontRegular, color: black });
    page.drawText(`- Rs. ${(data.baseCost || 0).toFixed(2)}`, { x: width - 120, y: y - 46, size: 9, font: fontRegular, color: black });

    if ((data.platformFee || 0) > 0) {
      page.drawText('Platform Fee (10%):', { x: 52, y: y - 60, size: 9, font: fontRegular, color: black });
      page.drawText(`- Rs. ${(data.platformFee || 0).toFixed(2)}`, { x: width - 120, y: y - 60, size: 9, font: fontRegular, color: black });
    }

    page.drawLine({ start: { x: 52, y: y - 68 }, end: { x: width - 52, y: y - 68 }, thickness: 1, color: green });
    page.drawText('Net Earnings:', { x: 52, y: y - 78, size: 10, font: fontBold, color: green });
    page.drawText(`Rs. ${(data.netEarnings || 0).toFixed(2)}`, { x: width - 120, y: y - 78, size: 11, font: fontBold, color: green });

    y -= 95;
  }

  // Footer
  const footerY = 40;
  page.drawLine({ start: { x: 40, y: footerY + 25 }, end: { x: width - 40, y: footerY + 25 }, thickness: 0.5, color: borderColor });
  page.drawText('This is a system-generated invoice from Pagen — Campus Print Network', { x: width / 2 - 160, y: footerY + 12, size: 8, font: fontRegular, color: darkGray });
  page.drawText(`Order ID: ${data.shortId}  |  Support: help@pagen.co  |  pagen.co`, { x: width / 2 - 140, y: footerY, size: 8, font: fontBold, color: black });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Trigger direct download of the A4 Portrait PDF file
 */
export async function downloadPdfFileDirect(data: InvoiceData): Promise<void> {
  try {
    const blob = await createPdfInvoiceBlob(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pagen-Invoice-${data.shortId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('PDF download error:', err);
    alert('Failed to generate PDF download.');
  }
}

/**
 * Open high-contrast A4 portrait preview with direct PDF download option
 */
export function downloadInvoice(data: InvoiceData): void {
  const invoiceHtml = generateInvoiceHtml(data);
  
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    alert('Please allow popups to view/download the invoice.');
    return;
  }
  
  previewWindow.document.write(invoiceHtml);
  previewWindow.document.close();
}

function generateInvoiceHtml(data: InvoiceData): string {
  const fileRows = data.files.map((file, i) => `
    <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 14px 18px; border-bottom: 1px solid #cbd5e1; font-size: 14px; color: #0f172a; font-weight: 700;">${i + 1}</td>
      <td style="padding: 14px 18px; border-bottom: 1px solid #cbd5e1; font-size: 14px; color: #0f172a; font-weight: 700;">${escapeHtml(file.name)}</td>
      <td style="padding: 14px 18px; border-bottom: 1px solid #cbd5e1; font-size: 14px; color: #0f172a; text-align: center; font-weight: 600;">${file.pages}</td>
      <td style="padding: 14px 18px; border-bottom: 1px solid #cbd5e1; font-size: 14px; color: #0f172a; text-align: center; font-weight: 600;">${file.colorMode === 'bw' ? 'B&W' : 'Color'}</td>
      <td style="padding: 14px 18px; border-bottom: 1px solid #cbd5e1; font-size: 14px; color: #0f172a; text-align: center; font-weight: 600;">${file.copies}</td>
    </tr>
  `).join('');

  const runnerSection = data.viewerRole === 'runner' ? `
    <div style="margin-top: 36px; padding: 24px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px;">
      <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.8px;">Earnings Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; font-size: 14px; color: #1e293b; font-weight: 600;">Total Collected</td>
          <td style="padding: 10px 0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 700;">${formatCurrency(data.totalPrice)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; font-size: 14px; color: #1e293b; font-weight: 600;">Base Print Cost</td>
          <td style="padding: 10px 0; font-size: 14px; color: #dc2626; text-align: right; font-weight: 700;">- ${formatCurrency(data.baseCost || 0)}</td>
        </tr>
        ${(data.platformFee || 0) > 0 ? `
        <tr>
          <td style="padding: 10px 0; font-size: 14px; color: #1e293b; font-weight: 600;">Platform Fee (10%)</td>
          <td style="padding: 10px 0; font-size: 14px; color: #dc2626; text-align: right; font-weight: 700;">- ${formatCurrency(data.platformFee || 0)}</td>
        </tr>
        ` : ''}
        <tr style="border-top: 2px solid #166534;">
          <td style="padding: 14px 0 0; font-size: 16px; color: #15803d; font-weight: 800;">Net Earnings</td>
          <td style="padding: 14px 0 0; font-size: 18px; color: #15803d; text-align: right; font-weight: 800;">${formatCurrency(data.netEarnings || 0)}</td>
        </tr>
      </table>
    </div>
  ` : '';

  const statusBg = data.status === 'delivered' ? '#dcfce7' : 
                   data.status === 'cancelled' ? '#fee2e2' : '#dbeafe';
  const statusBorder = data.status === 'delivered' ? '#86efac' : 
                       data.status === 'cancelled' ? '#fca5a5' : '#93c5fd';
  const statusText = data.status === 'delivered' ? '#15803d' : 
                     data.status === 'cancelled' ? '#b91c1c' : '#1d4ed8';
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagen Invoice — ${data.shortId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #e2e8f0;
      color: #0f172a;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Top action bar */
    .action-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      padding: 14px 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      z-index: 1000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    
    .action-bar button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
    }
    
    .action-bar button:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }

    .action-bar button:active {
      transform: translateY(0);
    }
    
    .action-bar .close-btn {
      background: #334155;
      color: #f8fafc;
      box-shadow: none;
    }
    
    .action-bar .close-btn:hover {
      background: #475569;
    }
    
    /* A4 Sheet Container */
    .a4-container {
      width: 210mm;
      min-height: 297mm;
      margin: 80px auto 40px auto;
      background: #ffffff;
      padding: 20mm;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.15);
      border-radius: 4px;
      position: relative;
    }

    @media print {
      body { background: #ffffff; }
      .action-bar { display: none !important; }
      .a4-container {
        margin: 0;
        box-shadow: none;
        width: 100%;
        padding: 15mm;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
</head>
<body>
  <!-- Download Bar -->
  <div class="action-bar no-print">
    <button id="download-btn" onclick="downloadPdfFile()">⬇️ Download A4 PDF Invoice</button>
    <button class="close-btn" onclick="window.close()">✕ Close Window</button>
  </div>

  <div class="a4-container">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 3px solid #0f172a;">
      <div>
        <h1 style="font-size: 36px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 2px;">PAGEN</h1>
        <p style="font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Campus Print Network</p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 30px; font-weight: 400; color: #334155; text-transform: uppercase; letter-spacing: 2px;">INVOICE</p>
        <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace; letter-spacing: 1px;">${data.shortId}</p>
      </div>
    </div>

    <!-- Status + Date Row -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; background: ${statusBg}; border: 2px solid ${statusBorder}; border-radius: 20px;">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusText};"></div>
        <span style="font-size: 13px; font-weight: 800; color: ${statusText}; text-transform: uppercase; letter-spacing: 0.5px;">${statusLabel}</span>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 12px; color: #334155; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Transaction Date</p>
        <p style="font-size: 15px; font-weight: 700; color: #0f172a;">${data.date} at ${data.time}</p>
      </div>
    </div>

    <!-- Parties -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
      <div style="padding: 20px; background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px;">
        <p style="font-size: 11px; color: #334155; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; margin-bottom: 8px;">BUYER</p>
        <p style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(data.buyerName)}</p>
        <p style="font-size: 13px; color: #334155; margin-top: 2px; font-weight: 600;">${escapeHtml(data.buyerEmail)}</p>
      </div>
      <div style="padding: 20px; background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px;">
        <p style="font-size: 11px; color: #334155; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; margin-bottom: 8px;">RUNNER</p>
        <p style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(data.runnerName)}</p>
        <p style="font-size: 13px; color: #334155; margin-top: 2px; font-weight: 600;">${escapeHtml(data.runnerEmail)}</p>
      </div>
    </div>

    <!-- Delivery Location -->
    <div style="margin-bottom: 32px; padding: 16px 20px; background: #f0f9ff; border: 2px solid #7dd3fc; border-radius: 10px; display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">📍</span>
      <div>
        <p style="font-size: 11px; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Delivery Location</p>
        <p style="font-size: 15px; font-weight: 800; color: #0369a1;">${escapeHtml(data.deliveryLocation)}</p>
      </div>
    </div>

    <!-- Document Table -->
    <div style="margin-bottom: 32px;">
      <h3 style="font-size: 13px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">Documents Printed</h3>
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a; border-radius: 10px; overflow: hidden;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 14px 18px; font-size: 12px; font-weight: 800; text-align: left; text-transform: uppercase; letter-spacing: 0.8px;">#</th>
            <th style="padding: 14px 18px; font-size: 12px; font-weight: 800; text-align: left; text-transform: uppercase; letter-spacing: 0.8px;">File Name</th>
            <th style="padding: 14px 18px; font-size: 12px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.8px;">Pages</th>
            <th style="padding: 14px 18px; font-size: 12px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.8px;">Mode</th>
            <th style="padding: 14px 18px; font-size: 12px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.8px;">Copies</th>
          </tr>
        </thead>
        <tbody>
          ${fileRows}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div style="display: flex; justify-content: flex-end;">
      <div style="width: 300px; padding: 22px; background: #0f172a; border-radius: 12px; color: #ffffff; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="font-size: 14px; color: #cbd5e1; font-weight: 600;">Total Pages</span>
          <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${data.totalPages}</span>
        </div>
        <div style="border-top: 2px solid #334155; padding-top: 14px; margin-top: 10px; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 13px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700;">Total Amount</span>
          <span style="font-size: 26px; font-weight: 800; color: #facc15;">${formatCurrency(data.totalPrice)}</span>
        </div>
      </div>
    </div>

    ${runnerSection}

    <!-- Footer -->
    <div style="margin-top: 56px; padding-top: 24px; border-top: 2px solid #cbd5e1; text-align: center;">
      <p style="font-size: 12px; color: #334155; font-weight: 600; margin-bottom: 4px;">This is a system-generated invoice from <strong style="color: #0f172a;">Pagen</strong> — Campus Print Network</p>
      <p style="font-size: 12px; color: #334155; font-weight: 600;">Order ID: <strong style="color: #0f172a;">${data.shortId}</strong> • Support: <strong style="color: #0f172a;">help@pagen.co</strong></p>
    </div>
  </div>

  <script>
    async function downloadPdfFile() {
      const btn = document.getElementById('download-btn');
      if (btn) btn.innerText = '⌛ Generating A4 PDF...';
      try {
        if (typeof PDFLib !== 'undefined') {
          const { PDFDocument, rgb, StandardFonts } = PDFLib;
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([595.28, 841.89]);
          const { width, height } = page.getSize();
          
          const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

          const black = rgb(0.06, 0.09, 0.16);
          const darkGray = rgb(0.2, 0.25, 0.33);
          const lightBg = rgb(0.97, 0.98, 0.99);
          const borderColor = rgb(0.8, 0.84, 0.88);
          const blue = rgb(0.01, 0.41, 0.63);
          const green = rgb(0.08, 0.5, 0.24);
          const white = rgb(1, 1, 1);
          const darkHeader = rgb(0.06, 0.09, 0.16);

          let y = height - 50;

          page.drawText('PAGEN', { x: 40, y, size: 28, font: fontBold, color: black });
          page.drawText('CAMPUS PRINT NETWORK', { x: 40, y: y - 16, size: 9, font: fontBold, color: darkGray });

          page.drawText('INVOICE', { x: width - 140, y, size: 22, font: fontRegular, color: darkGray });
          page.drawText('${data.shortId}', { x: width - 140, y: y - 18, size: 12, font: fontBold, color: black });

          y -= 45;
          page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 2, color: black });

          y -= 30;
          page.drawRectangle({ x: 40, y: y - 4, width: 100, height: 22, color: rgb(0.9, 0.97, 0.9), borderColor: green, borderWidth: 1 });
          page.drawText('${data.status.toUpperCase()}', { x: 52, y: y + 2, size: 10, font: fontBold, color: green });

          page.drawText('DATE:', { x: width - 220, y: y + 5, size: 9, font: fontBold, color: darkGray });
          page.drawText('${data.date} at ${data.time}', { x: width - 220, y: y - 8, size: 10, font: fontBold, color: black });

          y -= 45;
          const boxWidth = (width - 96) / 2;
          
          page.drawRectangle({ x: 40, y: y - 55, width: boxWidth, height: 65, color: lightBg, borderColor, borderWidth: 1 });
          page.drawText('BUYER', { x: 52, y: y - 4, size: 8, font: fontBold, color: darkGray });
          page.drawText('${escapeHtml(data.buyerName).substring(0, 25)}', { x: 52, y: y - 20, size: 12, font: fontBold, color: black });
          page.drawText('${escapeHtml(data.buyerEmail).substring(0, 30)}', { x: 52, y: y - 35, size: 9, font: fontRegular, color: darkGray });

          page.drawRectangle({ x: 40 + boxWidth + 16, y: y - 55, width: boxWidth, height: 65, color: lightBg, borderColor, borderWidth: 1 });
          page.drawText('RUNNER', { x: 52 + boxWidth + 16, y: y - 4, size: 8, font: fontBold, color: darkGray });
          page.drawText('${escapeHtml(data.runnerName).substring(0, 25)}', { x: 52 + boxWidth + 16, y: y - 20, size: 12, font: fontBold, color: black });
          page.drawText('${escapeHtml(data.runnerEmail).substring(0, 30)}', { x: 52 + boxWidth + 16, y: y - 35, size: 9, font: fontRegular, color: darkGray });

          y -= 75;
          page.drawRectangle({ x: 40, y: y - 25, width: width - 80, height: 35, color: rgb(0.94, 0.98, 1), borderColor: rgb(0.7, 0.85, 1), borderWidth: 1 });
          page.drawText('DELIVERY LOCATION', { x: 52, y: y - 2, size: 8, font: fontBold, color: blue });
          page.drawText('${escapeHtml(data.deliveryLocation)}', { x: 52, y: y - 17, size: 11, font: fontBold, color: blue });

          y -= 45;
          page.drawText('DOCUMENTS', { x: 40, y, size: 9, font: fontBold, color: darkGray });
          y -= 15;

          const tableWidth = width - 80;
          page.drawRectangle({ x: 40, y: y - 18, width: tableWidth, height: 22, color: darkHeader });
          page.drawText('#', { x: 50, y: y - 13, size: 9, font: fontBold, color: white });
          page.drawText('FILE NAME', { x: 80, y: y - 13, size: 9, font: fontBold, color: white });
          page.drawText('PAGES', { x: width - 200, y: y - 13, size: 9, font: fontBold, color: white });
          page.drawText('MODE', { x: width - 140, y: y - 13, size: 9, font: fontBold, color: white });
          page.drawText('COPIES', { x: width - 80, y: y - 13, size: 9, font: fontBold, color: white });

          y -= 22;
          ${JSON.stringify(data.files)}.forEach((file, index) => {
            const rowBg = index % 2 === 0 ? white : lightBg;
            page.drawRectangle({ x: 40, y: y - 18, width: tableWidth, height: 22, color: rowBg, borderColor, borderWidth: 0.5 });
            page.drawText(String(index + 1), { x: 50, y: y - 13, size: 9, font: fontRegular, color: black });
            page.drawText(String(file.name).substring(0, 35), { x: 80, y: y - 13, size: 9, font: fontBold, color: black });
            page.drawText(String(file.pages), { x: width - 190, y: y - 13, size: 9, font: fontRegular, color: black });
            page.drawText(file.colorMode === 'bw' ? 'B&W' : 'Color', { x: width - 140, y: y - 13, size: 9, font: fontRegular, color: black });
            page.drawText(String(file.copies || 1), { x: width - 70, y: y - 13, size: 9, font: fontRegular, color: black });
            y -= 22;
          });

          y -= 20;
          const sumWidth = 220;
          page.drawRectangle({ x: width - 40 - sumWidth, y: y - 45, width: sumWidth, height: 55, color: darkHeader });
          page.drawText('TOTAL PAGES:', { x: width - 40 - sumWidth + 15, y: y - 12, size: 9, font: fontBold, color: rgb(0.8, 0.85, 0.9) });
          page.drawText('${String(data.totalPages)}', { x: width - 60, y: y - 12, size: 10, font: fontBold, color: white });

          page.drawLine({ start: { x: width - 40 - sumWidth + 15, y: y - 22 }, end: { x: width - 55, y: y - 22 }, thickness: 1, color: rgb(0.3, 0.35, 0.4) });

          page.drawText('TOTAL AMOUNT:', { x: width - 40 - sumWidth + 15, y: y - 38, size: 9, font: fontBold, color: rgb(0.8, 0.85, 0.9) });
          page.drawText('Rs. ${data.totalPrice.toFixed(2)}', { x: width - 110, y: y - 40, size: 15, font: fontBold, color: rgb(0.98, 0.8, 0.1) });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'Pagen-Invoice-${data.shortId}.pdf';
          link.click();
        }
      } catch (e) {
        console.error(e);
        alert('Failed to generate PDF');
      } finally {
        if (btn) btn.innerText = '⬇️ Download A4 PDF Invoice';
      }
    }
  </script>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

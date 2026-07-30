/**
 * Pagen Invoice Generator
 * Generates a professional PDF invoice using browser canvas + jsPDF-like approach
 * Works entirely client-side — no server dependency
 */

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

// Generate and download the invoice as a printable HTML page
export function downloadInvoice(data: InvoiceData): void {
  const invoiceHtml = generateInvoiceHtml(data);
  
  // Open in a new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download the invoice.');
    return;
  }
  
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
  
  // Auto-trigger print dialog after content loads
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

function generateInvoiceHtml(data: InvoiceData): string {
  const fileRows = data.files.map((file, i) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151;">${i + 1}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; font-weight: 500;">${escapeHtml(file.name)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: center;">${file.pages}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: center;">${file.colorMode === 'bw' ? 'B&W' : 'Color'}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: center;">${file.copies}</td>
    </tr>
  `).join('');

  const runnerSection = data.viewerRole === 'runner' ? `
    <div style="margin-top: 32px; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
      <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Earnings Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #374151;">Total Collected</td>
          <td style="padding: 8px 0; font-size: 13px; color: #374151; text-align: right; font-weight: 500;">${formatCurrency(data.totalPrice)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #374151;">Base Print Cost</td>
          <td style="padding: 8px 0; font-size: 13px; color: #374151; text-align: right;">- ${formatCurrency(data.baseCost || 0)}</td>
        </tr>
        ${(data.platformFee || 0) > 0 ? `
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #374151;">Platform Fee (10%)</td>
          <td style="padding: 8px 0; font-size: 13px; color: #374151; text-align: right;">- ${formatCurrency(data.platformFee || 0)}</td>
        </tr>
        ` : ''}
        <tr style="border-top: 2px solid #166534;">
          <td style="padding: 12px 0 0; font-size: 15px; color: #166534; font-weight: 700;">Net Earnings</td>
          <td style="padding: 12px 0 0; font-size: 15px; color: #166534; text-align: right; font-weight: 700;">${formatCurrency(data.netEarnings || 0)}</td>
        </tr>
      </table>
    </div>
  ` : '';

  const statusColor = data.status === 'delivered' ? '#16a34a' : 
                       data.status === 'cancelled' ? '#dc2626' : '#2563eb';
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagen Invoice — ${data.shortId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #ffffff;
      color: #1f2937;
      line-height: 1.6;
    }
    
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 40px;
    }
    
    @media print {
      body { background: white; }
      .invoice-container { padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 0.5in; }
    }
    
    .download-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1f2937;
      padding: 12px 24px;
      display: flex;
      justify-content: center;
      gap: 16px;
      z-index: 100;
    }
    
    .download-bar button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 24px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    
    .download-bar button:hover { background: #2563eb; }
    
    .download-bar .close-btn {
      background: #6b7280;
    }
    
    .download-bar .close-btn:hover { background: #4b5563; }
  </style>
</head>
<body>
  <!-- Download/Print Bar -->
  <div class="download-bar no-print">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">✕ Close</button>
  </div>

  <div class="invoice-container" style="margin-top: 60px;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #1f2937;">
      <div>
        <h1 style="font-size: 32px; font-weight: 700; color: #1f2937; letter-spacing: -0.5px; margin-bottom: 4px;">PAGEN</h1>
        <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">Campus Print Network</p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 28px; font-weight: 300; color: #6b7280; text-transform: uppercase; letter-spacing: 2px;">Invoice</p>
        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin-top: 4px; font-family: monospace; letter-spacing: 1px;">${data.shortId}</p>
      </div>
    </div>

    <!-- Status + Date Row -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: ${statusColor}15; border: 1px solid ${statusColor}40; border-radius: 20px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></div>
        <span style="font-size: 12px; font-weight: 600; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.5px;">${statusLabel}</span>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
        <p style="font-size: 14px; font-weight: 500; color: #374151;">${data.date} at ${data.time}</p>
      </div>
    </div>

    <!-- Parties -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
      <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Buyer</p>
        <p style="font-size: 15px; font-weight: 600; color: #1f2937;">${escapeHtml(data.buyerName)}</p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(data.buyerEmail)}</p>
      </div>
      <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Runner</p>
        <p style="font-size: 15px; font-weight: 600; color: #1f2937;">${escapeHtml(data.runnerName)}</p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(data.runnerEmail)}</p>
      </div>
    </div>

    <!-- Delivery Location -->
    <div style="margin-bottom: 32px; padding: 14px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">📍</span>
      <div>
        <p style="font-size: 10px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Delivery Location</p>
        <p style="font-size: 14px; font-weight: 500; color: #1e40af;">${escapeHtml(data.deliveryLocation)}</p>
      </div>
    </div>

    <!-- Document Table -->
    <div style="margin-bottom: 32px;">
      <h3 style="font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Documents</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #6b7280; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">#</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #6b7280; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">File Name</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #6b7280; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Pages</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #6b7280; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Mode</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #6b7280; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Copies</th>
          </tr>
        </thead>
        <tbody>
          ${fileRows}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div style="display: flex; justify-content: flex-end;">
      <div style="width: 280px; padding: 20px; background: #1f2937; border-radius: 8px; color: white;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; color: #9ca3af;">Total Pages</span>
          <span style="font-size: 13px; font-weight: 500;">${data.totalPages}</span>
        </div>
        <div style="border-top: 1px solid #374151; padding-top: 12px; margin-top: 8px; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Total Amount</span>
          <span style="font-size: 24px; font-weight: 700; color: #fde68a;">${formatCurrency(data.totalPrice)}</span>
        </div>
      </div>
    </div>

    ${runnerSection}

    <!-- Footer -->
    <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">This is a system-generated invoice from <strong>Pagen</strong> — Campus Print Network</p>
      <p style="font-size: 11px; color: #9ca3af;">Order ID: ${data.shortId} • Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <p style="font-size: 10px; color: #d1d5db; margin-top: 8px;">pagen.co • Support: help@pagen.co</p>
    </div>
  </div>
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

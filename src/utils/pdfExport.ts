export const exportFloorPlanPDF = () => {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Please allow popups to export the floor plan');
    return;
  }

  const svg = document.querySelector('svg');
  if (!svg) {
    alert('Grid not found');
    return;
  }

  const svgClone = svg.cloneNode(true) as SVGSVGElement;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Floor Plan Export</title>
        <style>
          @page {
            size: landscape;
            margin: 0.5in;
          }
          body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          svg {
            display: block;
            margin: 0 auto;
            max-width: 100%;
            height: auto;
          }
          @media print {
            button {
              display: none;
            }
          }
          .print-button {
            display: block;
            margin: 20px auto;
            padding: 10px 20px;
            background: #3B82F6;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          .print-button:hover {
            background: #2563EB;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Floor Layout Plan</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
        ${svgClone.outerHTML}
        <button class="print-button" onclick="window.print()">Print / Save as PDF</button>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

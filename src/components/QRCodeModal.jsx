import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeModal({ isOpen, onClose, restaurant }) {
  const qrRef = useRef();
  if (!isOpen || !restaurant) return null;

  // Permanent QR URL points directly to /menu/:slug
  const menuUrl = `${window.location.origin}/?menu=${restaurant.slug}`;

  const handleDownload = () => {
    const svg = document.getElementById('permanent-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 80;
      canvas.height = img.height + 120;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 40, 40);

      ctx.fillStyle = '#082519';
      ctx.font = 'bold 20px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.fillText(restaurant.name, canvas.width / 2, canvas.height - 45);

      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#727974';
      ctx.fillText('Scan for Live Digital Menu', canvas.width / 2, canvas.height - 25);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${restaurant.slug}-menu-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-surface-container relative flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <span className="material-symbols-outlined text-primary text-3xl mb-1">qr_code_2</span>
        <h2 className="font-serif text-xl font-bold text-primary">{restaurant.name}</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Permanent Table QR Code</p>

        {/* QR Code Canvas Frame */}
        <div className="my-5 p-4 bg-white rounded-2xl shadow-md border border-surface-container flex flex-col items-center">
          <QRCodeSVG
            id="permanent-qr-svg"
            value={menuUrl}
            size={180}
            level="H"
            includeMargin={true}
          />
          <span className="text-[10px] text-outline mt-2 font-mono break-all max-w-[200px]">
            {menuUrl}
          </span>
        </div>

        <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
          This QR code is permanently linked to your restaurant slug{' '}
          <strong className="text-primary font-mono">{restaurant.slug}</strong>. It will remain valid even when menu items, categories, or prices are updated.
        </p>

        <div className="flex gap-2 w-full mt-6">
          <button
            onClick={handleDownload}
            className="flex-1 h-11 bg-primary-container text-on-primary rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Standee PNG
          </button>
          <a
            href={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 h-11 bg-surface-container hover:bg-surface-container-high text-primary rounded-xl font-semibold text-xs flex items-center justify-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Open
          </a>
        </div>
      </div>
    </div>
  );
}


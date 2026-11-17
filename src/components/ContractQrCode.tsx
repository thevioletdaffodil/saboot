import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ContractQrCodeProps {
  contractId: string;
  hashPrefix: string;
}

export const ContractQrCode: React.FC<ContractQrCodeProps> = ({ contractId, hashPrefix }) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toString(`saboot:${contractId}:${hashPrefix}`, {
      type: 'svg',
      margin: 1,
      width: 84,
      color: { dark: '#17153b', light: '#ffffff' },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup('');
      });
    return () => {
      active = false;
    };
  }, [contractId, hashPrefix]);

  if (!svgMarkup) {
    return (
      <div className="w-20 h-20 rounded-xl border border-slate-300 bg-white grid place-items-center text-xs font-mono text-slate-500">
        QR
      </div>
    );
  }

  return (
    <div
      className="w-20 h-20 rounded-xl border-2 border-slate-900 bg-white p-1 overflow-hidden shrink-0"
      aria-label={`Verification QR code for ${contractId}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};

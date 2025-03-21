'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError: (error: any) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const html5QrCode = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Create instance
    html5QrCode.current = new Html5Qrcode("reader");

    // Start scanning
    if (html5QrCode.current) {
      html5QrCode.current
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          onScan,
          onError
        )
        .catch(onError);
    }

    // Cleanup
    return () => {
      if (html5QrCode.current) {
        html5QrCode.current
          .stop()
          .then(() => {
            html5QrCode.current = null;
          })
          .catch((err) => {
            console.error('Failed to stop camera:', err);
          });
      }
    };
  }, [onScan, onError]);

  return <div id="reader" className="mb-4" />;
} 
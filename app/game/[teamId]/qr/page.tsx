'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Team, Point } from '../../../../types';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import QRScanner to avoid SSR issues
const QRScanner = dynamic(() => import('./QRScanner'), {
  ssr: false,
});

export default function QRGamePage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`/api/game/${params.teamId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch team data');
      }
      const data = await response.json();
      setTeam(data);
      
      // If team has a current point QR code, fetch that point
      if (data.currentPointQrCode) {
        const pointResponse = await fetch(`/api/points/qr/${data.currentPointQrCode}`);
        if (pointResponse.ok) {
          const pointData = await pointResponse.json();
          setCurrentPoint(pointData);
        }
      }
    } catch (err) {
      setError('Failed to load team data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (decodedText: string) => {
    if (decodedText && team) {
      try {
        // Stop scanning while processing
        setScanning(false);
        setLoading(true);

        // Verify the QR code
        const response = await fetch('/api/points/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamId: team._id,
            qrCode: decodedText
          }),
        });

        if (!response.ok) {
          throw new Error('Invalid QR code');
        }

        const result = await response.json();
        
        if (result.success) {
          // If this was the last point, redirect to completion page
          if (result.isLastPoint) {
            router.push(`/game/${team._id}/complete`);
            return;
          }

          // Update team state and current point
          setTeam(result.team);
          setCurrentPoint(result.point);
          setError(null);
        } else {
          setError(result.message || 'Invalid QR code');
        }
      } catch (err) {
        setError('Failed to verify QR code');
        console.error(err);
      } finally {
        setLoading(false);
        // Resume scanning
        setScanning(true);
      }
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    setError('Failed to access camera');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Team not found
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">QR Code Game</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {currentPoint ? (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Current Point: {currentPoint.name}</h2>
          <div className="bg-white p-4 rounded shadow">
            <p className="mb-2">{currentPoint.question}</p>
            <ul className="list-disc pl-5">
              {currentPoint.options.map((option, index) => (
                <li key={index}>{option.text}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mb-4">Scan a QR code to start</p>
      )}

      {scanning && <QRScanner onScan={handleScan} onError={handleError} />}

      <button
        onClick={() => setScanning(!scanning)}
        className={`${
          scanning
            ? 'bg-red-500 hover:bg-red-700'
            : 'bg-blue-500 hover:bg-blue-700'
        } text-white font-bold py-2 px-4 rounded transition-colors duration-200`}
        disabled={loading}
      >
        {scanning ? 'Stop Scanning' : 'Start Scanning'}
      </button>
    </div>
  );
} 
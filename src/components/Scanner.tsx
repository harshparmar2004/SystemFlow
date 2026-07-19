import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { openDB } from 'idb';
import { app } from '../lib/firebase';
import { getFunctions as getFirebaseFunctions, httpsCallable as firebaseHttpsCallable } from 'firebase/functions';
import { cn } from '../lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, WifiOff, Wifi, RefreshCw } from 'lucide-react';

// Setup IndexedDB for offline queue
const DB_NAME = 'hackathon-scanner-db';
const STORE_NAME = 'pending-scans';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

type ScanResultStatus = "SUCCESS" | "EXPIRED" | "DUPLICATE_SCAN" | "INVALID_SIGNATURE" | "NOT_VERIFIED" | "OFFLINE_QUEUED";

interface ScanFeedback {
  status: ScanResultStatus;
  message?: string;
}

export function Scanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";
  
  // Initialize DB and get pending count
  useEffect(() => {
    const updatePendingCount = async () => {
      const db = await initDB();
      const count = await db.count(STORE_NAME);
      setPendingCount(count);
    };
    updatePendingCount();
    
    // Set up online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Scanner
  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(scannerContainerId);
    }
    
    const startScanner = async () => {
      try {
        if (scannerRef.current && !scannerRef.current.isScanning) {
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            onScanFailure
          );
          setIsScanning(true);
        }
      } catch (err) {
        console.error("Error starting scanner:", err);
      }
    };
    
    startScanner();
    
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          setIsScanning(false);
        }).catch(err => {
          console.error("Error stopping scanner:", err);
        });
      }
    };
  }, []);

  const clearFeedbackTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const showFeedback = (status: ScanResultStatus, message?: string) => {
    setFeedback({ status, message });
    if (clearFeedbackTimeout.current) {
      clearTimeout(clearFeedbackTimeout.current);
    }
    clearFeedbackTimeout.current = setTimeout(() => {
      setFeedback(null);
    }, 3000);
  };

  const processScan = async (signedPayload: string) => {
    const gateId = "main_gate"; // Hardcoded for this volunteer view
    
    // Pause scanner to prevent multiple reads of same code rapidly
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.pause(true);
    }

    try {
      if (!isOnline) {
        throw new Error("Offline"); // Force offline flow
      }
      
      const functions = getFirebaseFunctions(app);
      const verifyScan = firebaseHttpsCallable(functions, 'verifyQrScan');
      
      // Attempt with timeout
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
      const res = await Promise.race([
        verifyScan({ signedPayload, gateId }),
        timeoutPromise
      ]) as any;
      
      const { status, message } = res.data;
      showFeedback(status, message);
      
    } catch (err: any) {
      // If network error, timeout, or offline
      if (!isOnline || err.message === "Timeout" || err.message === "Offline" || err.code === "unavailable") {
        // Queue offline
        const db = await initDB();
        await db.add(STORE_NAME, {
          signedPayload,
          gateId,
          timestamp: Date.now()
        });
        
        const count = await db.count(STORE_NAME);
        setPendingCount(count);
        
        showFeedback("OFFLINE_QUEUED", "Saved offline — will sync when connected");
      } else {
        // Actual function error
        console.error("Scan verification failed:", err);
        showFeedback("NOT_VERIFIED", "Verification failed. Check network or try again.");
      }
    } finally {
      // Resume scanning after a brief delay
      setTimeout(() => {
        if (scannerRef.current && scannerRef.current.isScanning) {
           scannerRef.current.resume();
        }
      }, 1500);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    // Basic validation of payload string format before trying to process
    if (decodedText.includes('|')) {
      processScan(decodedText);
    } else {
      showFeedback("INVALID_SIGNATURE", "Invalid QR code format");
    }
  };
  
  const onScanFailure = (error: any) => {
    // Ignore frame-by-frame read failures, just log if needed
  };

  const syncOfflineQueue = async () => {
    if (!isOnline || isSyncing) return;
    
    try {
      setIsSyncing(true);
      const db = await initDB();
      
      // Get all pending items
      const items = await db.getAll(STORE_NAME);
      if (items.length === 0) {
        setPendingCount(0);
        return;
      }
      
      const functions = getFirebaseFunctions(app);
      const verifyScan = firebaseHttpsCallable(functions, 'verifyQrScan');
      
      let successfulSyncs = 0;
      
      // Process sequentially to maintain order and manage load
      for (const item of items) {
        try {
           const res = await verifyScan({ 
             signedPayload: item.signedPayload, 
             gateId: item.gateId 
           });
           
           // If successful (or successfully processed and found duplicate/expired), remove from queue
           // We remove it from the queue regardless of the status if the server processed it.
           await db.delete(STORE_NAME, item.id);
           successfulSyncs++;
        } catch (err) {
           console.error("Failed to sync item", item.id, err);
           // Stop syncing if we hit a network error again
           break; 
        }
      }
      
      const remainingCount = await db.count(STORE_NAME);
      setPendingCount(remainingCount);
      
      if (successfulSyncs > 0) {
        console.log(`Successfully synced ${successfulSyncs} items`);
        // Optional: show a small toast for sync completion
      }
      
    } catch (err) {
      console.error("Error during offline sync:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const getFeedbackStyles = (status: ScanResultStatus) => {
    switch (status) {
      case "SUCCESS":
        return "bg-green-500 text-white border-green-600";
      case "OFFLINE_QUEUED":
        return "bg-yellow-500 text-white border-yellow-600";
      default:
        return "bg-red-500 text-white border-red-600";
    }
  };

  const getFeedbackIcon = (status: ScanResultStatus) => {
    switch (status) {
      case "SUCCESS": return <CheckCircle2 className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2" />;
      case "OFFLINE_QUEUED": return <RefreshCw className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2" />;
      default: return <XCircle className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2" />;
    }
  };
  
  const getFeedbackText = (status: ScanResultStatus) => {
    switch (status) {
      case "SUCCESS": return "Successfully Checked In";
      case "EXPIRED": return "QR Code Expired";
      case "DUPLICATE_SCAN": return "Already Checked In";
      case "INVALID_SIGNATURE": return "Invalid QR Code";
      case "NOT_VERIFIED": return "Team Not Verified";
      case "OFFLINE_QUEUED": return "Saved Offline";
      default: return "Error";
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white relative">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="font-bold text-lg text-white">Scanner</h1>
        
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div 
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors",
                isOnline ? "bg-burnt-orange text-white hover:bg-burnt-orange-dark" : "bg-yellow-500/20 text-yellow-500"
              )}
              onClick={syncOfflineQueue}
            >
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {pendingCount} pending
            </div>
          )}
          
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
            isOnline ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
          )}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* Main Scanner Area */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {/* The target div for html5-qrcode */}
        <div id={scannerContainerId} className="w-full max-w-lg mx-auto" />
        
        {/* Scanning Overlay (Targeting reticle) - html5-qrcode adds its own, but we can style around it if needed */}
        {!feedback && (
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50" />
        )}
      </div>

      {/* Visual Feedback Overlay */}
      {feedback && (
        <div className={cn(
          "absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200",
          getFeedbackStyles(feedback.status)
        )}>
          {getFeedbackIcon(feedback.status)}
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            {getFeedbackText(feedback.status)}
          </h2>
          {feedback.message && (
            <p className="text-white/90 text-sm md:text-base max-w-sm">
              {feedback.message}
            </p>
          )}
        </div>
      )}
      
      {/* Footer Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center z-10 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white/60 text-xs text-center">
          Point camera at participant's QR code.<br/>
          It will scan automatically.
        </p>
      </div>
    </div>
  );
}

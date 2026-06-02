import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Video, VideoOff, RefreshCw, Hand } from "lucide-react";
import toast from "react-hot-toast";

// ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

const SignLanguageDetector = () => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [currentPrediction, setCurrentPrediction] = useState("");
  const lastLetterRef = useRef("");
  const lastAddedTimeRef = useRef(0);
  const predictionHistoryRef = useRef([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isCameraOpen) {
      const wsHost = window.location.hostname;
      const isLocalHost = wsHost === 'localhost' || wsHost === '127.0.0.1' || wsHost.startsWith('10.') || wsHost.startsWith('192.168.') || wsHost.startsWith('172.');
      const defaultWsUrl = isLocalHost 
        ? `ws://${wsHost}:8000/ws/detect_dynamic` 
        : `wss://${wsHost}/ws/detect_dynamic`;
      const wsUrl = import.meta.env.VITE_SIGN_LANGUAGE_WS_URL || defaultWsUrl;
      socketRef.current = new WebSocket(wsUrl);
      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        drawFrame(data);
      };
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          intervalRef.current = setInterval(sendFrame, 66);
        };
      }
    } catch (err) {
      toast.error("Could not access camera");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (socketRef.current) socketRef.current.close();

    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCurrentPrediction("");
  };

  const sendFrame = () => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN &&
      videoRef.current &&
      canvasRef.current
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          socketRef.current.send(blob);
        },
        "image/jpeg",
        0.5,
      );
    }
  };

  const drawFrame = (data) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // =========================
    // DRAW VIDEO
    // =========================

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Mirror webcam
    ctx.scale(-1, 1);

    ctx.drawImage(
      videoRef.current,
      -canvas.width,
      0,
      canvas.width,
      canvas.height,
    );

    ctx.restore();

    // =========================
    // DRAW LANDMARKS
    // =========================

    if (data.landmarks) {
      // Draw hand points
      ctx.fillStyle = "#00DA83";

      data.landmarks.forEach((point) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });

      // =========================
      // LABEL POSITION
      // =========================

      const wrist = data.landmarks[0];

      const labelX = wrist.x * canvas.width;
      const labelY = wrist.y * canvas.height - 40;

      // =========================
      // REALTIME LABEL
      // =========================

      if (data.letter) {
        setCurrentPrediction(data.letter);

        // Build sentence
        const now = Date.now();
        const SAME_LETTER_COOLDOWN = 1200;
        const canAddSameLetter = now - lastAddedTimeRef.current > SAME_LETTER_COOLDOWN;

        predictionHistoryRef.current.push(data.letter);
        if (predictionHistoryRef.current.length > 15) {
          predictionHistoryRef.current.shift();
        }

        const isStable = predictionHistoryRef.current.length === 15 && 
                         predictionHistoryRef.current.every(val => val === data.letter);

        if (isStable && (data.letter !== lastLetterRef.current || canAddSameLetter)) {
          lastLetterRef.current = data.letter;
          lastAddedTimeRef.current = now;

          if (data.letter === "SPACE") {
            setDetectedText((prev) => prev + " ");
          } else if (data.letter !== "NOTHING") {
            setDetectedText((prev) => prev + data.letter);
          }
        }

        // =========================
        // LABEL UI
        // =========================

        const text = `${data.letter}`;

        ctx.font = "bold 28px Arial";

        const textWidth = ctx.measureText(text).width;

        // Background box
        ctx.fillStyle = "rgba(0,0,0,0.75)";

        ctx.beginPath();
        ctx.roundRect(labelX - 15, labelY - 35, textWidth + 30, 45, 12);

        ctx.fill();

        // Text
        ctx.fillStyle = "#00FFB3";

        ctx.fillText(text, labelX, labelY);

        // Optional confidence
        if (data.confidence) {
          ctx.font = "16px Arial";

          ctx.fillStyle = "white";

          ctx.fillText(
            `${Math.round(data.confidence * 100)}%`,
            labelX,
            labelY + 22,
          );
        }
      }
    } else {
      predictionHistoryRef.current = [];
      lastLetterRef.current = "";
      setCurrentPrediction("");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-xl p-4 sm:p-5 mt-5 mx-auto lg:ml-10 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg text-white transition-colors hover:bg-white/10"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            <Hand className="w-6 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Real-time Sign Detection
          </h1>
        </div>
        <button
          onClick={() => setIsCameraOpen(!isCameraOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            isCameraOpen
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95"
          }`}
        >
          {isCameraOpen ? (
            <>
              <VideoOff size={18} /> Stop
            </>
          ) : (
            <>
              <Video size={18} /> Start Camera
            </>
          )}
        </button>
      </div>

      <div className="relative aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/10 shadow-inner">
        <video ref={videoRef} className="hidden" />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          className="w-full h-full object-cover"
        />
        {!isCameraOpen && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-black/60 backdrop-blur-sm">
            <VideoOff size={48} className="mb-3 opacity-20" />
            <p className="font-medium">Camera is currently offline</p>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-black/20 rounded-xl border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Detected Sentence
          </p>
          <button
            onClick={() => {
              setDetectedText("");
              setCurrentPrediction("");
            }}
            className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="min-h-[60px] p-4 bg-black/40 rounded-lg border border-white/10 shadow-inner">
          <p className="text-2xl font-bold text-cyan-400 break-all drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            {detectedText || (
              <span className="text-slate-500 font-normal">
                Start signing to see text...
              </span>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default SignLanguageDetector;

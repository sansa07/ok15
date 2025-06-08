import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onSpeechEndRef = useRef<((text: string) => void) | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
    }
  }, []);

  const startListening = useCallback((onSpeechEnd?: (text: string) => void) => {
    if (!isSupported || isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    console.log('🎤 Starting speech recognition');
    
    // Yeni recognition instance oluştur
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    onSpeechEndRef.current = onSpeechEnd || null;
    finalTranscriptRef.current = '';

    // Ayarlar
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'tr-TR';

    recognition.onstart = () => {
      console.log('✅ Speech recognition started');
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
          finalTranscriptRef.current += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Transcript'i güncelle (interim + final)
      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      console.log('📝 Transcript updated:', currentTranscript);
      setTranscript(currentTranscript);

      // Eğer final sonuç varsa ve callback varsa (voice mode)
      if (finalTranscript && onSpeechEndRef.current) {
        console.log('🎯 Final result for voice mode:', finalTranscriptRef.current);
        const fullText = finalTranscriptRef.current.trim();
        if (fullText) {
          recognition.stop();
          onSpeechEndRef.current(fullText);
        }
      }
    };

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended');
      setIsListening(false);
      
      // Eğer voice mode değilse ve transcript varsa, onu koru
      if (!onSpeechEndRef.current && finalTranscriptRef.current) {
        console.log('💾 Keeping transcript for manual input:', finalTranscriptRef.current);
        setTranscript(finalTranscriptRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('❌ Error starting recognition:', error);
      setIsListening(false);
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('⏹️ Stopping speech recognition');
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcript');
    setTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
};
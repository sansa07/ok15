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
  const isVoiceModeRef = useRef(false);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
    }
  }, []);

  const startListening = useCallback((onSpeechEnd?: (text: string) => void) => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    console.log('🎤 Starting speech recognition', onSpeechEnd ? '(Voice Mode)' : '(Manual Mode)');
    
    // Set voice mode flag
    isVoiceModeRef.current = !!onSpeechEnd;
    shouldRestartRef.current = !!onSpeechEnd;
    
    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    onSpeechEndRef.current = onSpeechEnd || null;
    finalTranscriptRef.current = '';

    // Settings
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

      // Update transcript (interim + final)
      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      console.log('📝 Transcript updated:', currentTranscript);
      setTranscript(currentTranscript);

      // If we have final result and callback (voice mode)
      if (finalTranscript && onSpeechEndRef.current) {
        console.log('🎯 Final result for voice mode:', finalTranscriptRef.current);
        const fullText = finalTranscriptRef.current.trim();
        if (fullText) {
          // Stop current recognition
          recognition.stop();
          // Trigger callback with the text
          setTimeout(() => {
            if (onSpeechEndRef.current) {
              onSpeechEndRef.current(fullText);
            }
          }, 100);
        }
      }
    };

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended');
      setIsListening(false);
      
      // For manual mode, keep the transcript
      if (!isVoiceModeRef.current && finalTranscriptRef.current) {
        console.log('💾 Keeping transcript for manual input:', finalTranscriptRef.current);
        setTranscript(finalTranscriptRef.current);
      }
      
      // Clear the recognition reference
      recognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
      
      // If it's a voice mode error and we should restart, try again
      if (isVoiceModeRef.current && shouldRestartRef.current && event.error !== 'aborted') {
        console.log('🔄 Restarting after error in voice mode');
        setTimeout(() => {
          if (shouldRestartRef.current && onSpeechEndRef.current) {
            startListening(onSpeechEndRef.current);
          }
        }, 1000);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('❌ Error starting recognition:', error);
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('⏹️ Stopping speech recognition');
    shouldRestartRef.current = false;
    isVoiceModeRef.current = false;
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcript');
    setTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  // Function specifically for voice mode to restart listening
  const restartListening = useCallback((onSpeechEnd: (text: string) => void) => {
    if (!shouldRestartRef.current) return;
    
    console.log('🔄 Restarting listening for voice mode');
    setTimeout(() => {
      if (shouldRestartRef.current) {
        startListening(onSpeechEnd);
      }
    }, 500);
  }, [startListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    restartListening
  };
};
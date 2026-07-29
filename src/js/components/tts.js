/**
 * Text-to-Speech (TTS) Audio Guide Component
 */

let synth = null;
let currentUtterance = null;
let isSpeaking = false;

if ('speechSynthesis' in window) {
  synth = window.speechSynthesis;
}

export function speakText(text, onEndCallback) {
  if (!synth) {
    console.warn('Speech synthesis not supported on this browser');
    return false;
  }

  // Cancel any ongoing speech
  stopSpeech();

  if (!text || !text.trim()) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  utterance.rate = 0.95; // Slightly natural reading pace
  utterance.pitch = 1.0;

  // Try finding Turkish voice
  const voices = synth.getVoices();
  const trVoice = voices.find(v => v.lang.includes('tr'));
  if (trVoice) {
    utterance.voice = trVoice;
  }

  utterance.onend = () => {
    isSpeaking = false;
    currentUtterance = null;
    if (onEndCallback) onEndCallback();
  };

  utterance.onerror = (e) => {
    console.error('TTS error:', e);
    isSpeaking = false;
    currentUtterance = null;
    if (onEndCallback) onEndCallback();
  };

  currentUtterance = utterance;
  isSpeaking = true;
  synth.speak(utterance);
  return true;
}

export function stopSpeech() {
  if (synth && synth.speaking) {
    synth.cancel();
    isSpeaking = false;
    currentUtterance = null;
  }
}

export function isAudioGuidePlaying() {
  return synth ? synth.speaking : false;
}

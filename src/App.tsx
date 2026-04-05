import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image as ImageIcon, Upload, Eye, X, Check, MapPin, Calendar, Share2, Copy, Users, Wand2, Settings, Pencil, Music, Play, Pause } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';

type MessageType = 'text' | 'options' | 'input' | 'upload' | 'preview_btn' | 'upload_audio';

interface Option {
  id: string;
  label: string;
  image?: string;
  icon?: string;
}

interface RSVP {
  name: string;
  attending: string;
  guests: number;
  dietary: string;
  timestamp: number;
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  type: MessageType;
  content?: React.ReactNode;
  options?: Option[];
  inputType?: 'text' | 'date' | 'location' | 'time';
  inputPlaceholder?: string;
  step?: string;
  multiple?: boolean;
  imageUrls?: string[];
}

const CountdownTimer = ({ targetDate, targetTime }: { targetDate: string, targetTime?: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const calculateTime = () => {
      const now = new Date().getTime();
      let targetDateTimeStr = `${targetDate}T00:00:00`;
      if (targetTime) {
        targetDateTimeStr = `${targetDate}T${targetTime}:00`;
      }
      const distance = new Date(targetDateTimeStr).getTime() - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return false;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
      return true;
    };

    calculateTime();
    const interval = setInterval(() => {
      const shouldContinue = calculateTime();
      if (!shouldContinue) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <div className="flex justify-center gap-3 md:gap-6 my-8">
      {[
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Mins', value: timeLeft.minutes },
        { label: 'Secs', value: timeLeft.seconds }
      ].map((item, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-pink-50 flex items-center justify-center text-2xl md:text-3xl font-bold text-[#d98a8a] font-serif">
            {item.value.toString().padStart(2, '0')}
          </div>
          <span className="text-[10px] md:text-xs font-bold text-gray-500 mt-3 uppercase tracking-[0.2em]">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const compressImage = async (file: File, isMultiple: boolean = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = isMultiple ? 600 : 800;
        const MAX_HEIGHT = isMultiple ? 600 : 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', isMultiple ? 0.6 : 0.7)); // compress more if multiple
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const compressBase64Image = async (base64Str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = (err) => reject(err);
  });
};

const AutoSlider = ({ photos }: { photos: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [photos.length]);

  if (!photos.length) return null;

  return (
    <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden rounded-3xl shadow-lg">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={photos[currentIndex]}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {photos.map((_, idx) => (
            <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

const PreviewImage = ({ file }: { file: File }) => {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  
  if (!url) return null;
  
  return <img src={url} alt="preview" className="w-full h-full object-cover" />;
};

const FileUploadArea = ({ msg, onFiles, onSkip, onGenerate }: { msg: Message, onFiles: (files: FileList | null, step?: string) => void, onSkip: (step: string) => void, onGenerate: (step: string) => void }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (msg.multiple) {
        setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files!)]);
      } else {
        onFiles(e.dataTransfer.files, msg.step);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (msg.multiple) {
        setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      } else {
        onFiles(e.target.files, msg.step);
      }
    }
  };

  const handleUploadClick = () => {
    if (selectedFiles.length > 0) {
      const dt = new DataTransfer();
      selectedFiles.forEach(file => dt.items.add(file));
      onFiles(dt.files, msg.step);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-white p-6 rounded-3xl shadow-sm border-2 w-full mt-2 flex flex-col items-center justify-center gap-4 transition-colors ${isDragging ? 'border-[#d98a8a] bg-pink-50/50' : 'border-gray-50'}`}
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-[#d98a8a] text-white' : 'bg-pink-50 text-[#d98a8a]'}`}>
        <ImageIcon size={32} />
      </div>
      <p className="text-gray-600 font-medium text-center">
        {msg.multiple ? "Select multiple photos from your device, then click Upload." : "Drag & drop a high-quality photo, or click to upload."}
      </p>
      
      {msg.multiple && selectedFiles.length > 0 && (
        <div className="flex flex-col items-center gap-2 w-full">
          <p className="text-sm font-bold text-[#d98a8a]">{selectedFiles.length} photos selected</p>
          <div className="flex gap-2 flex-wrap justify-center mb-2">
            {selectedFiles.slice(0, 5).map((f, i) => (
              <div key={i} className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                <PreviewImage file={f} />
              </div>
            ))}
            {selectedFiles.length > 5 && (
              <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                +{selectedFiles.length - 5}
              </div>
            )}
          </div>
          <button 
            onClick={handleUploadClick}
            className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold cursor-pointer hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Upload size={18} />
            <span>Upload {selectedFiles.length} Pictures</span>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        <label className="bg-[#d98a8a] text-white px-6 py-3 rounded-full font-bold cursor-pointer hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2">
          <Upload size={18} />
          <span>{msg.multiple ? (selectedFiles.length > 0 ? 'Add More Images' : 'Select Images') : 'Select Image'}</span>
          <input 
            type="file" 
            accept="image/*" 
            multiple={msg.multiple}
            className="hidden" 
            onChange={handleFileSelect}
          />
        </label>
        {!msg.multiple && (
          <button
            onClick={() => onGenerate(msg.step!)}
            className="bg-gray-900 text-white px-6 py-3 rounded-full font-bold cursor-pointer hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            <Wand2 size={18} />
            <span>Generate with AI</span>
          </button>
        )}
      </div>
      <button 
        onClick={() => onSkip(msg.step!)}
        className="text-[13px] text-gray-400 hover:text-gray-600 mt-2 font-medium transition-colors"
      >
        Skip this step
      </button>
    </div>
  );
};

const MusicPlayer = ({ url, name, isViewMode, isPublished, hasRsvps }: { url: string, name: string, isViewMode: boolean, isPublished: boolean, hasRsvps: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
    }
  }, []);

  if (!url) return null;

  return (
    <div className={`fixed left-6 z-50 bg-white p-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 ${!isViewMode && (isPublished || hasRsvps) ? 'bottom-28' : 'bottom-6'}`}>
      <audio ref={audioRef} src={url} loop />
      <button 
        onClick={togglePlay}
        className="w-10 h-10 bg-[#d98a8a] text-white rounded-full flex items-center justify-center hover:bg-[#c87979] transition-colors shadow-sm"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
      </button>
      <div className="hidden md:block pr-4">
        <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">Background Music</p>
        <p className="text-xs text-gray-500 truncate max-w-[150px]">{name || 'Playing'}</p>
      </div>
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // State to store collected event data
  const [eventData, setEventData] = useState({
    occasion: '',
    brideName: '',
    groomName: '',
    brideParents: '',
    groomParents: '',
    date: '',
    time: '',
    location: '',
    schedule: '',
    accommodations: '',
    bannerImage: '',
    bridePhoto: '',
    groomPhoto: '',
    galleryPhotos: [] as string[],
    memoriesPhotos: [] as string[],
    musicUrl: '',
    musicName: ''
  });
  
  // State for preview modal
  const [showPreview, setShowPreview] = useState(false);

  // State for RSVP form inside preview
  const [rsvpState, setRsvpState] = useState<'idle' | 'filling' | 'submitted'>('idle');
  const [rsvpForm, setRsvpForm] = useState({ name: '', attending: 'yes', guests: 1, dietary: '' });

  // State for publishing
  const [isPublished, setIsPublished] = useState(false);

  // State for RSVPs
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [showGuestList, setShowGuestList] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Firebase states
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Share & Edit State
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{id: string, step: string, value: string} | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Location Search State
  const [locationSuggestions, setLocationSuggestions] = useState<{display_name: string}[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);

  useEffect(() => {
    const currentMsg = messages[messages.length - 1];
    if (currentMsg?.inputType !== 'location') {
      setShowLocationSuggestions(false);
      return;
    }

    // Request location when the location step is active
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location", error);
        }
      );
    }

    const timer = setTimeout(async () => {
      if (inputValue.trim().length > 2) {
        try {
          let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&limit=5`;
          if (userLocation) {
            url += `&lat=${userLocation.lat}&lon=${userLocation.lon}`;
          }
          const res = await fetch(url);
          const data = await res.json();
          setLocationSuggestions(data);
          setShowLocationSuggestions(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue, messages, userLocation]);

  // Initial messages & Firebase Auth/Routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('invite');

    if (id) {
      setIsViewMode(true);
      setInviteId(id);
      const fetchInvite = async () => {
        try {
          const docRef = doc(db, 'invitations', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setEventData(docSnap.data() as any);
            setShowPreview(true);
            setIsPublished(true);
          } else {
            alert('Invitation not found!');
          }
        } catch (error) {
          console.error("Error fetching invite", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchInvite();
      return;
    }

    setIsLoading(false);

    const initial: Message[] = [
      {
        id: '1',
        sender: 'bot',
        type: 'text',
        content: (
          <span>
            Welcome to BigDate! I'm here to help you design your <span className="text-[#d98a8a] font-bold">Event Website</span> easily and quickly.
          </span>
        ),
      },
      {
        id: '2',
        sender: 'bot',
        type: 'text',
        content: (
          <span>
            Tell me your <span className="text-[#d98a8a] font-bold">Occasion</span>.
          </span>
        ),
      },
      {
        id: '3',
        sender: 'bot',
        type: 'options',
        options: [
          { id: 'wedding', label: 'Wedding', image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=400&q=80' },
          { id: 'betrothal', label: 'Betrothal', image: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=400&q=80' },
          { id: 'haldi', label: 'Haldi', image: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=400&q=80' },
        ]
      }
    ];
    
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Stagger the initial messages slightly for a nice effect
    initial.forEach((msg, index) => {
      const timeout = setTimeout(() => {
        setMessages(prev => {
          // Prevent duplicates in StrictMode
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }, index * 800);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!inviteId) return;
    const rsvpsRef = collection(db, 'invitations', inviteId, 'rsvps');
    const unsubscribe = onSnapshot(rsvpsRef, (snapshot) => {
      const rsvpData: RSVP[] = [];
      snapshot.forEach((doc) => {
        rsvpData.push(doc.data() as RSVP);
      });
      // Sort by timestamp descending
      rsvpData.sort((a, b) => b.timestamp - a.timestamp);
      setRsvps(rsvpData);
    }, (error) => {
      console.error("Error fetching RSVPs", error);
    });
    return () => unsubscribe();
  }, [inviteId]);

  const addBotMessage = (content: React.ReactNode) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      sender: 'bot',
      type: 'text',
      content
    }]);
  };

  const addBotInput = (inputType: 'text' | 'date' | 'location' | 'time', inputPlaceholder: string, step: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      sender: 'bot',
      type: 'input',
      inputType,
      inputPlaceholder,
      step
    }]);
  };

  const addBotUpload = (step: string, multiple: boolean = false) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      sender: 'bot',
      type: 'upload',
      step,
      multiple
    }]);
  };

  const handleOptionSelect = (option: Option) => {
    if (option.id === 'wedding' || option.id === 'betrothal' || option.id === 'haldi') {
      // Save occasion
      setEventData(prev => ({ ...prev, occasion: option.label }));

      // Add user message
      setMessages(prev => [...prev.filter(m => m.type !== 'options'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: option.label,
        step: 'occasion'
      }]);

      // Next step: Ask for Bride's name
      setTimeout(() => {
        addBotMessage(<span>Great! What is the <span className="font-bold text-[#d98a8a]">Bride's</span> name?</span>);
        addBotInput('text', 'e.g. Anjali', 'brideName');
      }, 1000);
    } else if (option.id === 'upload_music') {
      setMessages(prev => [...prev.filter(m => m.type !== 'options'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: option.label,
      }]);
      setTimeout(() => {
        addBotMessage("Please upload your music file (MP3/WAV).");
        setMessages(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          sender: 'bot',
          type: 'upload_audio',
          step: 'music'
        }]);
      }, 1000);
    } else if (option.id === 'choose_music') {
      setMessages(prev => [...prev.filter(m => m.type !== 'options'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: option.label,
      }]);
      setTimeout(() => {
        addBotMessage("Choose a track from the list:");
        setMessages(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          sender: 'bot',
          type: 'options',
          options: [
            { id: 'music_1', label: 'Romantic Piano', icon: '🎹' },
            { id: 'music_2', label: 'Acoustic Guitar', icon: '🎸' },
            { id: 'music_3', label: 'Wedding March', icon: '💒' }
          ]
        }]);
      }, 1000);
    } else if (option.id === 'skip_music') {
      setMessages(prev => [...prev.filter(m => m.type !== 'options'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: option.label,
      }]);
      proceedToNextStep('music');
    } else if (option.id.startsWith('music_')) {
      const musicUrls: Record<string, string> = {
        'music_1': 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3?filename=romantic-piano-128166.mp3',
        'music_2': 'https://cdn.pixabay.com/download/audio/2022/02/07/audio_c6b122c508.mp3?filename=acoustic-guitar-wedding-115390.mp3',
        'music_3': 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_88447e769f.mp3?filename=wedding-march-1-6812.mp3'
      };
      setEventData(prev => ({ ...prev, musicUrl: musicUrls[option.id], musicName: option.label }));
      setMessages(prev => [...prev.filter(m => m.type !== 'options'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: option.label,
      }]);
      proceedToNextStep('music');
    }
  };

  const proceedToNextStep = (step: string) => {
    if (step === 'brideName') {
      setTimeout(() => {
        addBotMessage(<span>And what is the <span className="font-bold text-[#d98a8a]">Groom's</span> name?</span>);
        addBotInput('text', 'e.g. Rahul', 'groomName');
      }, 1000);
    } else if (step === 'groomName') {
      setTimeout(() => {
        addBotMessage("What are the Bride's parents' names?");
        addBotInput('text', 'e.g. Mr. & Mrs. Sharma', 'brideParents');
      }, 1000);
    } else if (step === 'brideParents') {
      setTimeout(() => {
        addBotMessage("What are the Groom's parents' names?");
        addBotInput('text', 'e.g. Mr. & Mrs. Verma', 'groomParents');
      }, 1000);
    } else if (step === 'groomParents') {
      setTimeout(() => {
        addBotMessage("When is the big day?");
        addBotInput('date', '', 'date');
        setInputValue(new Date().toISOString().split('T')[0]);
      }, 1000);
    } else if (step === 'date') {
      setTimeout(() => {
        addBotMessage("What time does the event start?");
        addBotInput('time', '', 'time');
        setInputValue('10:00');
      }, 1000);
    } else if (step === 'time') {
      setTimeout(() => {
        addBotMessage("Where is the event taking place? (Search for Venue & City)");
        addBotInput('location', 'Search location...', 'location');
      }, 1000);
    } else if (step === 'location') {
      setTimeout(() => {
        addBotMessage("Do you have a specific schedule or timings for different events? (e.g., 10 AM: Baraat, 12 PM: Wedding. Or type 'Skip')");
        addBotInput('text', 'e.g. 10 AM: Ceremony, 1 PM: Reception', 'schedule');
      }, 1000);
    } else if (step === 'schedule') {
      setTimeout(() => {
        addBotMessage("Awesome! Let's set up a beautiful banner for your website. You can upload one or generate a custom one using AI.");
        addBotUpload('bannerImage');
      }, 1000);
    } else if (step === 'bannerImage') {
      setTimeout(() => {
        addBotMessage("Awesome! Now, please upload a beautiful picture of the Bride.");
        addBotUpload('bridePhoto');
      }, 1500);
    } else if (step === 'bridePhoto') {
      setTimeout(() => {
        addBotMessage("Lovely! Now, please upload a handsome picture of the Groom.");
        addBotUpload('groomPhoto');
      }, 1500);
    } else if (step === 'groomPhoto') {
      setTimeout(() => {
        addBotMessage("Great! Finally, upload a few more pictures of the couple (up to 4 photos) for the gallery.");
        addBotUpload('galleryPhotos', true);
      }, 1500);
    } else if (step === 'galleryPhotos') {
      setTimeout(() => {
        addBotMessage("Awesome! Now, let's add some special 'Memories'. Upload photos for an auto-sliding memories section (up to 10 photos).");
        addBotUpload('memoriesPhotos', true);
      }, 1500);
    } else if (step === 'memoriesPhotos') {
      setTimeout(() => {
        addBotMessage("Would you like to add background music to your website?");
        setMessages(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          sender: 'bot',
          type: 'options',
          options: [
            { id: 'upload_music', label: 'Upload Music', icon: '🎵' },
            { id: 'choose_music', label: 'Choose from List', icon: '🎶' },
            { id: 'skip_music', label: 'Skip', icon: '⏭️' }
          ]
        }]);
      }, 1500);
    } else if (step === 'music') {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          type: 'text',
          content: <span>Perfect! I have all the details. I've generated your beautiful event website... ✨</span>
        }, {
          id: (Date.now() + 2).toString(),
          sender: 'bot',
          type: 'preview_btn'
        }]);
      }, 1500);
    }
  };

  const handleSkip = (step: string) => {
    const actualStep = step.replace('generate_', '');
    
    // Add user message indicating skip
    setMessages(prev => [...prev.filter(m => m.type !== 'input' && m.type !== 'upload'), {
      id: Date.now().toString(),
      sender: 'user',
      type: 'text',
      content: 'Skip',
      step: actualStep
    }]);
    setInputValue('');
    setShowLocationSuggestions(false);

    // Add related image automatically if it's an image step
    if (actualStep === 'bannerImage') {
      setEventData(prev => ({ ...prev, bannerImage: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80' }));
    } else if (actualStep === 'bridePhoto') {
      setEventData(prev => ({ ...prev, bridePhoto: 'https://images.unsplash.com/photo-1546822452-97216656c07a?auto=format&fit=crop&w=400&q=80' }));
    } else if (actualStep === 'groomPhoto') {
      setEventData(prev => ({ ...prev, groomPhoto: 'https://images.unsplash.com/photo-1550005809-91ad75fb315f?auto=format&fit=crop&w=400&q=80' }));
    } else if (actualStep === 'galleryPhotos') {
      setEventData(prev => ({ ...prev, galleryPhotos: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=800&q=80'
      ] }));
    } else if (actualStep === 'memoriesPhotos') {
      setEventData(prev => ({ ...prev, memoriesPhotos: [
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=800&q=80'
      ] }));
    }

    // Proceed to the next step
    proceedToNextStep(actualStep);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const currentInputMsg = messages[messages.length - 1];
    const step = currentInputMsg.step;

    if (inputValue.trim().toLowerCase() === 'skip' && step?.startsWith('generate_')) {
      handleSkip(step);
      return;
    }
    
    // Add user message
    setMessages(prev => [...prev.filter(m => m.type !== 'input'), {
      id: Date.now().toString(),
      sender: 'user',
      type: 'text',
      content: inputValue,
      step: step
    }]);
    setInputValue('');
    setShowLocationSuggestions(false);

    if (step === 'brideName') {
      setEventData(prev => ({ ...prev, brideName: inputValue }));
    } else if (step === 'groomName') {
      setEventData(prev => ({ ...prev, groomName: inputValue }));
    } else if (step === 'brideParents') {
      setEventData(prev => ({ ...prev, brideParents: inputValue }));
    } else if (step === 'groomParents') {
      setEventData(prev => ({ ...prev, groomParents: inputValue }));
    } else if (step === 'date') {
      setEventData(prev => ({ ...prev, date: inputValue }));
    } else if (step === 'time') {
      setEventData(prev => ({ ...prev, time: inputValue }));
    } else if (step === 'location') {
      setEventData(prev => ({ ...prev, location: inputValue }));
    } else if (step === 'schedule') {
      setEventData(prev => ({ ...prev, schedule: inputValue }));
    } else if (step === 'accommodations') {
      setEventData(prev => ({ ...prev, accommodations: inputValue }));
    } else if (step === 'generate_bannerImage') {
      handleGenerateImage(inputValue, 'bannerImage');
      return;
    } else if (step === 'generate_bridePhoto') {
      handleGenerateImage(inputValue, 'bridePhoto');
      return;
    } else if (step === 'generate_groomPhoto') {
      handleGenerateImage(inputValue, 'groomPhoto');
      return;
    }

    if (step) {
      proceedToNextStep(step);
    }
  };

  const handleGenerateImage = async (prompt: string, step: string) => {
    const loadingId = Date.now().toString();
    // Add bot message
    setMessages(prev => [...prev, {
      id: loadingId,
      sender: 'bot',
      type: 'text',
      content: (
        <div className="flex items-center gap-2">
          <Wand2 className="animate-spin text-[#d98a8a]" size={18} />
          <span>Generating your image... ✨</span>
        </div>
      )
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: step === 'bannerImage' ? '16:9' : '1:1',
          }
        }
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const rawImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
          imageUrl = await compressBase64Image(rawImageUrl);
          break;
        }
      }

      if (!imageUrl) throw new Error('No image generated');

      // Update state
      if (step === 'bannerImage') {
        setEventData(prev => ({ ...prev, bannerImage: imageUrl }));
      } else if (step === 'bridePhoto') {
        setEventData(prev => ({ ...prev, bridePhoto: imageUrl }));
      } else if (step === 'groomPhoto') {
        setEventData(prev => ({ ...prev, groomPhoto: imageUrl }));
      }

      // Remove loading message and add result
      setMessages(prev => [...prev.filter(m => m.id !== loadingId), {
        id: Date.now().toString(),
        sender: 'bot',
        type: 'text',
        content: 'Here is your generated image!',
        imageUrls: [imageUrl],
        step: step
      }]);

      // Proceed to next step
      proceedToNextStep(step);

    } catch (error) {
      console.error('Error generating image:', error);
      setMessages(prev => [...prev.filter(m => m.id !== loadingId), {
        id: Date.now().toString(),
        sender: 'bot',
        type: 'text',
        content: "Sorry, I couldn't generate the image. Please try uploading one instead."
      }]);
      addBotUpload(step);
    }
  };

  const processFiles = async (files: FileList | null, step?: string) => {
    if (!files || files.length === 0) return;

    if (step === 'galleryPhotos' || step === 'memoriesPhotos') {
      const limit = step === 'galleryPhotos' ? 4 : 10;
      const newPhotos = await Promise.all(
        Array.from(files).slice(0, limit).map(f => compressImage(f as File, true))
      );
      
      if (step === 'galleryPhotos') {
        setEventData(prev => ({ ...prev, galleryPhotos: newPhotos }));
      } else {
        setEventData(prev => ({ ...prev, memoriesPhotos: newPhotos }));
      }
      
      setMessages(prev => [...prev.filter(m => m.type !== 'upload'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: `Uploaded ${newPhotos.length} photos`,
        imageUrls: newPhotos,
        step: step
      }]);

      setTimeout(() => {
        proceedToNextStep(step!);
      }, 1500);

    } else {
      const file = files[0];
      const imageUrl = await compressImage(file);
      
      if (step === 'bannerImage') {
        setEventData(prev => ({ ...prev, bannerImage: imageUrl }));
      } else if (step === 'bridePhoto') {
        setEventData(prev => ({ ...prev, bridePhoto: imageUrl }));
      } else if (step === 'groomPhoto') {
        setEventData(prev => ({ ...prev, groomPhoto: imageUrl }));
      }
      
      setMessages(prev => [...prev.filter(m => m.type !== 'upload'), {
        id: Date.now().toString(),
        sender: 'user',
        type: 'text',
        content: 'Uploaded photo',
        imageUrls: [imageUrl],
        step: step
      }]);

      if (step) proceedToNextStep(step);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, step?: string) => {
    processFiles(e.target.files, step);
  };

  const handleEditUpload = async (e: React.ChangeEvent<HTMLInputElement>, messageId: string, step: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (step === 'galleryPhotos' || step === 'memoriesPhotos') {
      const limit = step === 'galleryPhotos' ? 4 : 10;
      const newPhotos = await Promise.all(
        Array.from(files).slice(0, limit).map(f => compressImage(f as File, true))
      );
      
      if (step === 'galleryPhotos') {
        setEventData(prev => ({ ...prev, galleryPhotos: newPhotos }));
      } else {
        setEventData(prev => ({ ...prev, memoriesPhotos: newPhotos }));
      }
      
      setMessages(prev => prev.map(m => m.id === messageId ? {
        ...m,
        content: `Uploaded ${newPhotos.length} photos`,
        imageUrls: newPhotos
      } : m));

    } else {
      const imageUrl = await compressImage(files[0]);
      
      if (step === 'bannerImage') {
        setEventData(prev => ({ ...prev, bannerImage: imageUrl }));
      } else if (step === 'bridePhoto') {
        setEventData(prev => ({ ...prev, bridePhoto: imageUrl }));
      } else if (step === 'groomPhoto') {
        setEventData(prev => ({ ...prev, groomPhoto: imageUrl }));
      }
      
      setMessages(prev => prev.map(m => m.id === messageId ? {
        ...m,
        imageUrls: [imageUrl]
      } : m));
    }
  };

  const handleShareClick = async () => {
    setIsPublishing(true);
    try {
      const isFirstPublish = !inviteId;
      let finalId = inviteId;

      if (!finalId) {
        const newInviteRef = doc(collection(db, 'invitations'));
        finalId = newInviteRef.id;
      }

      const inviteRef = doc(db, 'invitations', finalId);
      
      const dataToSave: any = {
        ...eventData,
        creatorId: 'anonymous',
      };

      // Avoid a blocking pre-read; reads fail first when client is offline.
      if (isFirstPublish) {
        dataToSave.createdAt = Date.now();
      }

      await setDoc(inviteRef, dataToSave, { merge: true });

      setInviteId(finalId);
      setIsPublished(true);
      
      const newUrl = `${window.location.origin}${window.location.pathname}?invite=${finalId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      setShowShareModal(true);
    } catch (error: any) {
      console.error("Error publishing", error);
      
      let errorMessage = "Failed to generate share link. Please try again.";
      
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        errorMessage = "Permission denied. Your Firebase Security Rules might be blocking this action, or the data is too large/invalid.";
      } else if (error?.code === 'unavailable' || error?.message?.toLowerCase?.().includes('client is offline')) {
        errorMessage = "You're currently offline. Reconnect to the internet and try sharing again.";
      } else if (error?.message?.includes('payload size exceeds the limit') || error?.code === 'resource-exhausted') {
        errorMessage = "The total size of your images and music exceeds the 1MB limit. Please try using smaller files or fewer images.";
      } else if (error instanceof Error) {
        errorMessage = `Publish failed: ${error.message}`;
      }
      
      alert(errorMessage);
    }
    setIsPublishing(false);
  };

  const handleEditSave = () => {
    if (!editingMessage) return;

    const { id, step, value } = editingMessage;

    // Update message content
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: value } : m));

    // Update eventData based on step
    setEventData(prev => {
      const newData = { ...prev };
      if (step === 'occasion') newData.occasion = value;
      else if (step === 'brideName') newData.brideName = value;
      else if (step === 'groomName') newData.groomName = value;
      else if (step === 'brideParents') newData.brideParents = value;
      else if (step === 'groomParents') newData.groomParents = value;
      else if (step === 'date') newData.date = value;
      else if (step === 'time') newData.time = value;
      else if (step === 'location') newData.location = value;
      else if (step === 'schedule') newData.schedule = value;
      else if (step === 'accommodations') newData.accommodations = value;
      return newData;
    });

    setEditingMessage(null);
  };



  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Wand2 className="animate-spin text-[#d98a8a]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto p-4 md:p-6 flex flex-col">
      {!isViewMode && (
        <div className="flex-1 pb-24">
          <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
              className={`mb-6 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="flex items-start gap-3 max-w-[90%] md:max-w-[85%]">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 relative z-10 flex items-center justify-center">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Mimi&backgroundColor=transparent" alt="Bot" className="w-full h-full object-contain" />
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full">
                    {msg.type === 'text' && (
                      <div className="bg-white px-6 py-4 rounded-3xl rounded-tl-sm shadow-sm border border-gray-100 text-gray-700 font-medium text-[17px] leading-relaxed relative group">
                        {/* Little tail */}
                        <div className="absolute top-0 -left-2 w-3 h-4 bg-white" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                        {msg.content}
                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {msg.imageUrls.map((url, i) => (
                              <img key={i} src={url} alt="Generated" className="w-48 h-32 object-cover rounded-xl shadow-sm" />
                            ))}
                            {msg.step && (
                              <label className="absolute -top-3 -right-3 bg-white text-gray-600 p-2 rounded-full shadow-md cursor-pointer hover:text-[#d98a8a] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10">
                                <Pencil size={14} />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  multiple={msg.step === 'galleryPhotos' || msg.step === 'memoriesPhotos'}
                                  className="hidden" 
                                  onChange={(e) => handleEditUpload(e, msg.id, msg.step!)}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {msg.type === 'options' && (
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 w-full mt-2">
                        <h3 className="text-[#2c3e50] font-semibold text-xl mb-5">Choose :</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {msg.options?.map(opt => (
                            <button 
                              key={opt.id}
                              onClick={() => handleOptionSelect(opt)}
                              className="bg-[#d98a8a] rounded-2xl p-3 flex flex-col items-center justify-center gap-3 hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md overflow-hidden relative group"
                            >
                              <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/20">
                                {opt.image ? (
                                  <img src={opt.image} alt={opt.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-4xl shadow-inner">
                                    {opt.icon}
                                  </div>
                                )}
                              </div>
                              <span className="text-white font-bold text-lg">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.type === 'input' && (
                      <div className="flex flex-col items-center gap-1 w-full mt-2 relative">
                        <form onSubmit={handleInputSubmit} className="bg-white p-2 rounded-full shadow-sm border border-gray-100 flex items-center gap-2 w-full">
                          <input
                            type={msg.inputType === 'location' ? 'text' : (msg.inputType || 'text')}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={msg.inputPlaceholder}
                            className="flex-1 bg-transparent px-4 py-2 outline-none text-gray-600 font-medium placeholder:text-gray-400"
                            autoFocus
                          />
                          {msg.inputType === 'location' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.geolocation) {
                                  navigator.geolocation.getCurrentPosition(async (position) => {
                                    try {
                                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
                                      const data = await res.json();
                                      if (data && data.display_name) {
                                        setInputValue(data.display_name);
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  });
                                }
                              }}
                              className="text-gray-400 hover:text-[#d98a8a] p-2 transition-colors"
                              title="Use current location"
                            >
                              <MapPin size={18} />
                            </button>
                          )}
                          <button 
                            type="submit"
                            disabled={!inputValue.trim()}
                            className="bg-[#e8b4b4] text-white p-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={18} />
                          </button>
                        </form>
                        
                        {/* Location Suggestions Dropdown */}
                        {msg.inputType === 'location' && showLocationSuggestions && locationSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50">
                            {locationSuggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setInputValue(s.display_name);
                                  setShowLocationSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-sm text-gray-700 transition-colors"
                              >
                                {s.display_name}
                              </button>
                            ))}
                          </div>
                        )}

                        <button 
                          onClick={() => handleSkip(msg.step!)}
                          className="text-[13px] text-gray-400 hover:text-gray-600 font-medium transition-colors mt-1"
                        >
                          Skip this step
                        </button>
                      </div>
                    )}

                    {msg.type === 'upload' && (
                      <FileUploadArea 
                        msg={msg} 
                        onFiles={processFiles} 
                        onSkip={handleSkip} 
                        onGenerate={(step) => {
                          setMessages(prev => [...prev.filter(m => m.id !== msg.id)]);
                          addBotMessage("What kind of image would you like to generate? (e.g. 'A beautiful floral banner with pink roses')");
                          addBotInput('text', 'Describe the image...', `generate_${step}`);
                        }} 
                      />
                    )}

                    {msg.type === 'upload_audio' && (
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-50 w-full mt-2 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-pink-50 text-[#d98a8a]">
                          <Music size={32} />
                        </div>
                        <p className="text-gray-600 font-medium text-center">
                          Select an audio file (MP3, WAV)
                        </p>
                        <label className="bg-[#d98a8a] text-white px-6 py-3 rounded-full font-bold cursor-pointer hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2">
                          <Upload size={18} />
                          <span>Select Audio</span>
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 700 * 1024) {
                                  alert("File is too large. Please choose a file under 700KB, or select from the pre-defined list.");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  setEventData(prev => ({ ...prev, musicUrl: base64, musicName: file.name }));
                                  setMessages(prev => [...prev.filter(m => m.type !== 'upload_audio'), {
                                    id: Date.now().toString(),
                                    sender: 'user',
                                    type: 'text',
                                    content: `Uploaded ${file.name}`
                                  }]);
                                  proceedToNextStep('music');
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {msg.type === 'preview_btn' && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button
                          onClick={() => setShowPreview(true)}
                          className="bg-gray-900 text-white px-6 py-3 rounded-full font-bold cursor-pointer hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-2"
                        >
                          <Eye size={18} />
                          <span>Preview Website</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {msg.sender === 'user' && (
                <div className="bg-[#d98a8a] text-white px-6 py-4 rounded-3xl rounded-tr-sm shadow-sm max-w-[80%] font-medium text-[17px] leading-relaxed relative group">
                   {/* Little tail for user */}
                   <div className="absolute top-0 -right-2 w-3 h-4 bg-[#d98a8a]" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                  {typeof msg.content === 'string' && msg.content.toLowerCase() === 'skip' ? <span className="italic text-white/80">Skipped</span> : msg.content}
                  
                  {msg.type === 'text' && msg.step && msg.step !== 'music' && (!msg.imageUrls || msg.imageUrls.length === 0) && typeof msg.content === 'string' && (
                    ['bannerImage', 'bridePhoto', 'groomPhoto', 'galleryPhotos', 'memoriesPhotos'].includes(msg.step) ? (
                      <label className="absolute -top-3 -left-3 bg-white text-gray-600 p-2 rounded-full shadow-md cursor-pointer hover:text-[#d98a8a] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10">
                        <Pencil size={14} />
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple={msg.step === 'galleryPhotos' || msg.step === 'memoriesPhotos'}
                          className="hidden" 
                          onChange={(e) => handleEditUpload(e, msg.id, msg.step!)}
                        />
                      </label>
                    ) : (
                      <button 
                        onClick={() => setEditingMessage({ id: msg.id, step: msg.step!, value: (typeof msg.content === 'string' && msg.content.toLowerCase() === 'skip') ? '' : String(msg.content ?? '') })}
                        className="absolute -top-3 -left-3 bg-white text-gray-600 p-2 rounded-full shadow-md cursor-pointer hover:text-[#d98a8a] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                      >
                        <Pencil size={14} />
                      </button>
                    )
                  )}

                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap justify-end">
                      {msg.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="Uploaded" className={`object-cover rounded-lg shadow-sm ${msg.imageUrls!.length > 1 ? 'w-20 h-20' : 'w-48 h-32'}`} />
                      ))}
                      {msg.step && (
                        <label className="absolute -top-3 -left-3 bg-white text-gray-600 p-2 rounded-full shadow-md cursor-pointer hover:text-[#d98a8a] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10">
                          <Pencil size={14} />
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple={msg.step === 'galleryPhotos' || msg.step === 'memoriesPhotos'}
                            className="hidden" 
                            onChange={(e) => handleEditUpload(e, msg.id, msg.step!)}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className={`fixed inset-0 z-50 bg-white flex flex-col overflow-hidden ${isViewMode ? 'static min-h-screen' : ''}`}
          >
            {/* Modal Header */}
            {!isViewMode && (
              <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
                <h2 className="font-bold text-gray-800 text-lg">Website Preview</h2>
                <button 
                  onClick={() => {
                    setShowPreview(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
            )}

            {/* Generated Website Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm pb-20 relative">
                
                {/* Music Player */}
                {eventData.musicUrl && (
                  <MusicPlayer 
                    url={eventData.musicUrl} 
                    name={eventData.musicName} 
                    isViewMode={isViewMode}
                    isPublished={isPublished}
                    hasRsvps={rsvps.length > 0}
                  />
                )}

                {/* Hero Section */}
                <div className="relative h-[60vh] min-h-[400px] w-full bg-pink-50 flex items-center justify-center overflow-hidden">
                  {(eventData.bannerImage || eventData.galleryPhotos[0]) && (
                    <img 
                      src={eventData.bannerImage || eventData.galleryPhotos[0]} 
                      alt="Hero" 
                      className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/80"></div>
                  
                  <div className="relative z-10 text-center p-6">
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    >
                      <h3 className="text-xl md:text-2xl font-medium tracking-widest uppercase mb-4 text-[#d98a8a]">
                        {eventData.occasion} Celebration
                      </h3>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    >
                      <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 text-gray-800 drop-shadow-sm">
                        {eventData.brideName || 'Bride'} & {eventData.groomName || 'Groom'}
                      </h1>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      whileInView={{ opacity: 1, width: 96 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="h-1 bg-[#d98a8a] mx-auto mb-6 rounded-full"
                    ></motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                      className="flex flex-col items-center gap-3 text-gray-700"
                    >
                      <p className="text-xl md:text-2xl font-light tracking-wider flex items-center gap-2 text-center flex-wrap justify-center">
                        <Calendar size={24} className="text-[#d98a8a]" />
                        <span>
                          {eventData.date ? new Date(`${eventData.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Save the Date'}
                          {eventData.time && ` at ${new Date(`2000-01-01T${eventData.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        </span>
                      </p>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-medium flex items-center gap-2 hover:text-[#d98a8a] transition-colors"
                      >
                        <MapPin size={20} className="text-[#d98a8a]" />
                        {eventData.location || 'Location TBD'}
                      </a>
                    </motion.div>
                  </div>
                </div>

                {/* Countdown Section */}
                {eventData.date && (
                  <div className="relative -mt-16 z-20 px-4">
                    <CountdownTimer targetDate={eventData.date} targetTime={eventData.time} />
                  </div>
                )}

                {/* Couple Section */}
                <div className="py-20 px-6 max-w-5xl mx-auto overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                    <motion.div 
                      initial={{ opacity: 0, x: -50 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8 }}
                      className="text-center flex-1"
                    >
                      <div className="w-56 h-56 mx-auto rounded-full overflow-hidden mb-6 border-4 border-pink-100 shadow-lg">
                        <img src={eventData.bridePhoto || 'https://images.unsplash.com/photo-1546822452-97216656c07a?auto=format&fit=crop&w=400&q=80'} className="w-full h-full object-cover" alt="Bride" />
                      </div>
                      <h2 className="text-3xl font-serif font-bold text-gray-800 mb-2">{eventData.brideName || 'Bride'}</h2>
                      <p className="text-gray-500 italic mb-1">Daughter of</p>
                      <p className="text-gray-700 font-medium text-lg">{eventData.brideParents || "Bride's Parents"}</p>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 0.5, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      className="text-5xl text-[#d98a8a] font-serif"
                    >
                      &
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, x: 50 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8 }}
                      className="text-center flex-1"
                    >
                      <div className="w-56 h-56 mx-auto rounded-full overflow-hidden mb-6 border-4 border-pink-100 shadow-lg">
                        <img src={eventData.groomPhoto || 'https://images.unsplash.com/photo-1550005809-91ad75fb315f?auto=format&fit=crop&w=400&q=80'} className="w-full h-full object-cover" alt="Groom" />
                      </div>
                      <h2 className="text-3xl font-serif font-bold text-gray-800 mb-2">{eventData.groomName || 'Groom'}</h2>
                      <p className="text-gray-500 italic mb-1">Son of</p>
                      <p className="text-gray-700 font-medium text-lg">{eventData.groomParents || "Groom's Parents"}</p>
                    </motion.div>
                  </div>
                </div>

                {/* Gallery Section */}
                {eventData.galleryPhotos.length > 0 && (
                  <div className="py-16 px-6 bg-pink-50/30 overflow-hidden">
                    <motion.h2 
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6 }}
                      className="text-3xl font-bold text-center text-gray-800 mb-10 font-serif"
                    >
                      Captured Moments
                    </motion.h2>
                    <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                      {eventData.galleryPhotos.map((url, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.1 }}
                          className="aspect-square rounded-2xl overflow-hidden shadow-sm border-4 border-white"
                        >
                          <img src={url} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" alt={`Gallery ${i}`} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Memories Section */}
                {eventData.memoriesPhotos && eventData.memoriesPhotos.length > 0 && (
                  <div className="py-16 px-6 max-w-5xl mx-auto overflow-hidden">
                    <motion.h2 
                      initial={{ opacity: 0, x: 30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6 }}
                      className="text-3xl font-bold text-center text-gray-800 mb-10 font-serif"
                    >
                      Sweet Memories
                    </motion.h2>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    >
                      <AutoSlider photos={eventData.memoriesPhotos} />
                    </motion.div>
                  </div>
                )}

                {/* Venue & Location Section */}
                {eventData.location && (
                  <div className="py-10 px-6 max-w-2xl mx-auto text-center overflow-hidden">
                    <motion.h2 
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6 }}
                      className="text-3xl font-bold text-gray-800 mb-6 font-serif"
                    >
                      Venue & Location
                    </motion.h2>
                    <motion.div 
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100"
                    >
                      <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden bg-gray-100 mb-4 relative">
                        <iframe
                          title="Venue Map"
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(eventData.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                        ></iframe>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2 uppercase tracking-wide">
                        {eventData.location.split(',')[0].trim()}
                      </h3>
                      {eventData.location.split(',').length > 1 && (
                        <p className="text-gray-500 uppercase text-sm tracking-wider mb-4">
                          {eventData.location.split(',').slice(1).join(',').trim()}
                        </p>
                      )}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#d98a8a] text-white px-8 py-3 rounded-full font-bold hover:bg-[#c87979] transition-colors shadow-md mt-4"
                      >
                        <MapPin size={18} />
                        <span>Navigate Location</span>
                      </a>
                    </motion.div>
                  </div>
                )}

                {/* Details Section & RSVP */}
                <div className="py-20 px-6 text-center overflow-hidden">
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-3xl font-bold text-gray-800 mb-6 font-serif"
                  >
                    Join us to celebrate!
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed"
                  >
                    We are so excited to share this special {eventData.occasion.toLowerCase() || 'event'} with our favorite people. 
                    Please explore the website for more details about the event, travel information, and to RSVP.
                  </motion.p>

                  <div className="max-w-4xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                    {((eventData.schedule && eventData.schedule.toLowerCase() !== 'skip') || !isViewMode) && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative group"
                      >
                        {!isViewMode && (
                          <button onClick={() => setEditingMessage({ id: 'schedule', step: 'schedule', value: (!eventData.schedule || eventData.schedule.toLowerCase() === 'skip') ? '' : eventData.schedule })} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-800">
                            <Pencil size={16} />
                          </button>
                        )}
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
                          <Calendar className="text-[#d98a8a]" /> Schedule
                        </h3>
                        <div className="text-gray-600 whitespace-pre-line leading-relaxed">
                          {(!eventData.schedule || eventData.schedule.toLowerCase() === 'skip') ? (
                            <span className="italic opacity-50">No schedule added. Click the pencil icon to add one.</span>
                          ) : (
                            eventData.schedule
                          )}
                        </div>
                      </motion.div>
                    )}

                    {((eventData.accommodations && eventData.accommodations.toLowerCase() !== 'skip') || !isViewMode) && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative group"
                      >
                        {!isViewMode && (
                          <button onClick={() => setEditingMessage({ id: 'accommodations', step: 'accommodations', value: (!eventData.accommodations || eventData.accommodations.toLowerCase() === 'skip') ? '' : eventData.accommodations })} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-800">
                            <Pencil size={16} />
                          </button>
                        )}
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
                          <MapPin className="text-[#d98a8a]" /> Accommodations
                        </h3>
                        <div className="text-gray-600 whitespace-pre-line leading-relaxed">
                          {(!eventData.accommodations || eventData.accommodations.toLowerCase() === 'skip') ? (
                            <span className="italic opacity-50">No accommodations added. Click the pencil icon to add one.</span>
                          ) : (
                            eventData.accommodations
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* RSVP Section */}
                  {rsvpState === 'idle' && (
                    <button 
                      onClick={() => setRsvpState('filling')}
                      className="mt-10 bg-[#d98a8a] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#c87979] transition-colors shadow-md"
                    >
                      RSVP Now
                    </button>
                  )}

                  {rsvpState === 'filling' && (
                    <motion.form 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      onSubmit={async (e) => { 
                        e.preventDefault(); 
                        if (inviteId) {
                          try {
                            await addDoc(collection(db, 'invitations', inviteId, 'rsvps'), {
                              ...rsvpForm,
                              timestamp: Date.now()
                            });
                            setRsvpState('submitted');
                          } catch (error) {
                            console.error("Error submitting RSVP", error);
                            alert("Failed to submit RSVP.");
                          }
                        } else {
                          setRsvps(prev => [...prev, { ...rsvpForm, timestamp: Date.now() }]);
                          setRsvpState('submitted'); 
                        }
                      }} 
                      className="mt-10 max-w-md mx-auto bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 text-left"
                    >
                      <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">RSVP</h3>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="e.g. Jane Doe"
                            value={rsvpForm.name} 
                            onChange={e => setRsvpForm({...rsvpForm, name: e.target.value})} 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d98a8a] focus:bg-white transition-all" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Will you attend?</label>
                          <div className="flex flex-col gap-3">
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rsvpForm.attending === 'yes' ? 'border-[#d98a8a] bg-pink-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                              <input 
                                type="radio" 
                                name="attending" 
                                value="yes" 
                                checked={rsvpForm.attending === 'yes'} 
                                onChange={e => setRsvpForm({...rsvpForm, attending: e.target.value})} 
                                className="w-4 h-4 text-[#d98a8a] focus:ring-[#d98a8a]" 
                              />
                              <span className="font-medium text-gray-700">Joyfully Accept</span>
                            </label>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rsvpForm.attending === 'no' ? 'border-[#d98a8a] bg-pink-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                              <input 
                                type="radio" 
                                name="attending" 
                                value="no" 
                                checked={rsvpForm.attending === 'no'} 
                                onChange={e => setRsvpForm({...rsvpForm, attending: e.target.value})} 
                                className="w-4 h-4 text-[#d98a8a] focus:ring-[#d98a8a]" 
                              />
                              <span className="font-medium text-gray-700">Regretfully Decline</span>
                            </label>
                          </div>
                        </div>
                        
                        {rsvpForm.attending === 'yes' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Guests</label>
                              <input 
                                type="number" 
                                min="1" 
                                max="10" 
                                value={rsvpForm.guests} 
                                onChange={e => setRsvpForm({...rsvpForm, guests: parseInt(e.target.value) || 1})} 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d98a8a] focus:bg-white transition-all" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Dietary Restrictions (Optional)</label>
                              <textarea 
                                placeholder="e.g. Vegetarian, Gluten-free"
                                value={rsvpForm.dietary} 
                                onChange={e => setRsvpForm({...rsvpForm, dietary: e.target.value})} 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d98a8a] focus:bg-white transition-all resize-none" 
                                rows={2}
                              ></textarea>
                            </div>
                          </motion.div>
                        )}
                        
                        <button type="submit" className="w-full bg-[#d98a8a] text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-[#c87979] transition-colors shadow-sm mt-2">
                          Send RSVP
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setRsvpState('idle')}
                          className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {rsvpState === 'submitted' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-10 max-w-md mx-auto bg-[#fdf8f8] text-gray-800 p-8 rounded-3xl border border-pink-100 shadow-sm"
                    >
                      <div className="w-16 h-16 bg-[#d98a8a] text-white rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Thank you, {rsvpForm.name}!</h3>
                      <p className="text-gray-600 mb-6">
                        Your RSVP has been received. <br/>
                        {rsvpForm.attending === 'yes' 
                          ? "We can't wait to celebrate with you!" 
                          : "We will miss you!"}
                      </p>
                      <button 
                        onClick={() => { 
                          setRsvpState('idle'); 
                          setRsvpForm({ name: '', attending: 'yes', guests: 1, dietary: '' }); 
                        }} 
                        className="text-sm font-bold text-[#d98a8a] hover:text-[#c87979] transition-colors"
                      >
                        Submit another response
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Map Button */}
            {eventData.location && (
              <button 
                onClick={() => setShowMapModal(true)}
                className={`absolute right-6 z-40 bg-white text-[#d98a8a] p-4 rounded-full shadow-lg hover:bg-gray-50 transition-colors flex items-center justify-center border border-gray-100 ${!isViewMode && (isPublished || rsvps.length > 0) ? 'bottom-28' : 'bottom-6'}`}
                title="View Location"
              >
                <MapPin size={24} />
              </button>
            )}

            {/* Action Bar */}
            {!isViewMode && (
              <div className="h-20 border-t border-gray-100 bg-white shrink-0 flex items-center justify-between px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3">
                  {rsvps.length > 0 && (
                    <button 
                      onClick={() => setShowGuestList(true)}
                      className="bg-pink-50 text-[#d98a8a] px-5 py-3 rounded-full font-bold hover:bg-pink-100 transition-colors flex items-center gap-2"
                    >
                      <Users size={20} />
                      <span className="hidden sm:inline">Guest List ({rsvps.length})</span>
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleShareClick}
                    disabled={isPublishing}
                    className="bg-gray-100 text-gray-800 px-5 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-md disabled:opacity-70"
                  >
                    <Share2 size={20} />
                    <span className="hidden sm:inline">{isPublishing ? 'Saving...' : 'Share'}</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Map Modal */}
            <AnimatePresence>
              {showMapModal && eventData.location && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl"
                  >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 font-serif">Venue Location</h2>
                        <p className="text-sm text-gray-500 mt-1">{eventData.location}</p>
                      </div>
                      <button onClick={() => setShowMapModal(false)} className="p-3 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm">
                        <X size={20} className="text-gray-600" />
                      </button>
                    </div>
                    <div className="p-6 bg-white">
                      <div className="w-full h-[60vh] bg-gray-100 rounded-2xl overflow-hidden relative">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0 }} 
                          loading="lazy" 
                          allowFullScreen 
                          referrerPolicy="no-referrer-when-downgrade" 
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(eventData.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                        ></iframe>
                      </div>
                      <div className="mt-6 flex justify-center">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#d98a8a] text-white px-8 py-3 rounded-full font-bold hover:bg-[#c87979] transition-colors shadow-md"
                        >
                          <MapPin size={18} />
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Guest List Modal */}
            <AnimatePresence>
              {showGuestList && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                  >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 font-serif">Guest List</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage your RSVPs</p>
                      </div>
                      <button onClick={() => setShowGuestList(false)} className="p-3 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm">
                        <X size={20} className="text-gray-600" />
                      </button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 bg-white">
                      {rsvps.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Users size={32} />
                          </div>
                          <p className="text-gray-500 font-medium text-lg">No RSVPs yet.</p>
                          <p className="text-gray-400 text-sm mt-1">Share your website to start receiving responses!</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {rsvps.map((rsvp, idx) => (
                            <div key={idx} className="p-5 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:shadow-md transition-shadow bg-gray-50/30">
                              <div>
                                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                  {rsvp.name}
                                  {rsvp.attending === 'yes' ? (
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold tracking-wide uppercase">Attending</span>
                                  ) : (
                                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-md font-bold tracking-wide uppercase">Declined</span>
                                  )}
                                </h4>
                                {rsvp.attending === 'yes' && (
                                  <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                                    <Users size={14} className="text-gray-400" />
                                    {rsvp.guests} {rsvp.guests === 1 ? 'Guest' : 'Guests'}
                                  </p>
                                )}
                                {rsvp.dietary && (
                                  <p className="text-sm text-gray-600 mt-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 inline-block shadow-sm">
                                    <span className="font-semibold text-gray-700">Dietary:</span> {rsvp.dietary}
                                  </p>
                                )}
                              </div>
                              <div className="text-xs font-medium text-gray-400 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm self-start sm:self-auto">
                                {new Date(rsvp.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm font-medium">
                      <div className="flex items-center gap-2 text-green-700 bg-green-100/50 px-4 py-2 rounded-xl">
                        <Check size={16} />
                        <span>Total Attending: {rsvps.filter(r => r.attending === 'yes').reduce((acc, curr) => acc + curr.guests, 0)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-red-700 bg-red-100/50 px-4 py-2 rounded-xl">
                        <X size={16} />
                        <span>Declined: {rsvps.filter(r => r.attending === 'no').length}</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setEditingMessage(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Detail</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2 capitalize">
                  {editingMessage.step.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                {(editingMessage.step === 'schedule' || editingMessage.step === 'accommodations') ? (
                  <textarea
                    value={editingMessage.value}
                    onChange={(e) => setEditingMessage({ ...editingMessage, value: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[#d98a8a] transition-all min-h-[120px]"
                    autoFocus
                  />
                ) : (
                  <input
                    type={editingMessage.step === 'date' ? 'date' : editingMessage.step === 'time' ? 'time' : 'text'}
                    value={editingMessage.value}
                    onChange={(e) => setEditingMessage({ ...editingMessage, value: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[#d98a8a] transition-all"
                    autoFocus
                  />
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setEditingMessage(null)}
                  className="px-6 py-3 rounded-full font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditSave}
                  className="bg-[#d98a8a] text-white px-6 py-3 rounded-full font-bold hover:bg-[#c87979] transition-colors shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 font-serif">Share Invitation</h2>
                  <p className="text-sm text-gray-500 mt-1">Invite your friends and family</p>
                </div>
                <button onClick={() => setShowShareModal(false)} className="p-3 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm">
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
              <div className="p-6 bg-white space-y-4">
                <div className="flex flex-col gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`We're celebrating our ${eventData.occasion || 'Special Event'}! 🎉 Join us on our special day. Check out our invitation and RSVP here: ${window.location.href}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-3"
                  >
                    <Share2 size={20} />
                    <span>Share via Device</span>
                  </a>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`We're celebrating our ${eventData.occasion || 'Special Event'}! 🎉 Join us on our special day. Check out our invitation and RSVP here: ${window.location.href}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white py-4 rounded-xl font-bold hover:bg-[#20bd5a] transition-colors shadow-sm flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

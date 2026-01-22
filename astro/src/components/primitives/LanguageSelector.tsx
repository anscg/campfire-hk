import { useEffect, useState } from 'react';

interface LanguageSelectorProps {
  onSelectLanguage: (language: 'en' | 'zh') => void;
}

function LanguageSelector({ onSelectLanguage }: LanguageSelectorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show popup after a short delay for better UX
    setTimeout(() => setIsVisible(true), 300);
  }, []);

  const handleLanguageSelect = (language: 'en' | 'zh') => {
    onSelectLanguage(language);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div 
        className="relative bg-[#f9e2ca] border-[6px] border-[#d5a16c] rounded-[30px] p-8 md:p-12 shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-w-md w-full transform animate-scale-in"
      >
        <div className="relative z-10">
          <h2 
            className="text-[#854d16] text-5xl md:text-6xl font-bold text-center mb-6 font-dream-planner"
            style={{
              textShadow: "3px 3px 0px rgba(133,77,22,0.2)"
            }}
          >
            SELECT LANGUAGE
          </h2>
          
          <p className="text-[#854d16] text-2xl md:text-3xl font-bold text-center mb-8 font-ember-and-fire">
            選擇語言
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => handleLanguageSelect('en')}
              className="bg-[#fca147] border-[5px] border-[rgba(0,0,0,0.2)] rounded-[20px] px-8 py-5 hover:scale-105 transition-transform transform hover:rotate-[-1deg] shadow-[0_8px_20px_rgba(0,0,0,0.25)] cursor-pointer active:scale-95"
            >
              <p className="text-[#8d3f34] text-3xl md:text-4xl font-normal font-dream-planner">
                ENGLISH
              </p>
            </button>

            <button
              onClick={() => handleLanguageSelect('zh')}
              className="bg-[#fca147] border-[5px] border-[rgba(0,0,0,0.2)] rounded-[20px] px-8 py-5 hover:scale-105 transition-transform transform hover:rotate-[1deg] shadow-[0_8px_20px_rgba(0,0,0,0.25)] cursor-pointer active:scale-95"
            >
              <p className="text-[#8d3f34] text-3xl md:text-4xl font-bold font-ember-and-fire">
                中文
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LanguageSelector;

interface FaqButtonProps {
  content: string;
}

function FaqButton({ content }: FaqButtonProps) {
  return (
    <div className="bg-[#091e8b] shadow-[8px_8px_0px_0px_#0a1861] flex items-start px-5 py-12 h-[168px] w-[467px]">
      <div className="flex gap-1 items-center">
        <div className="relative w-12 h-12 overflow-hidden">
          <img 
            alt="" 
            className="absolute -inset-1 w-full h-full object-cover select-none" 
            src="/icons/plus.svg" 
          />
        </div>
        <p 
          className="text-white text-5xl font-bold leading-none whitespace-nowrap font-amatic"
        >
          {content}
        </p>
      </div>
    </div>
  );
}

export default FaqButton;

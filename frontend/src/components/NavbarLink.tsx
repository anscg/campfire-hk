interface NavbarLinkProps {
  children: string;
  onClick: () => void;
}

function NavbarLink({ children, onClick }: NavbarLinkProps) {
  return (
    <button 
      className="relative hover:opacity-80 transition-opacity cursor-pointer group"
      onClick={onClick}
    >
      <span className="relative">
        {children}
        <span className="absolute left-0 -bottom-1 w-0 h-[3px] bg-white transition-all duration-300 ease-out group-hover:w-full"></span>
      </span>
    </button>
  );
}

export default NavbarLink;

interface NavbarLinkProps {
  children: string;
  onClick: () => void;
}

function NavbarLink({ children, onClick }: NavbarLinkProps) {
  return (
    <button 
      className="relative cursor-pointer group hover:scale-110 active:scale-95 transition-transform"
      onClick={onClick}
    >
      <span className="relative">
        {children}
      </span>
    </button>
  );
}

export default NavbarLink;

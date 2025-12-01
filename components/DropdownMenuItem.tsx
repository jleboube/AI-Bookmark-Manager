import React from 'react';

interface DropdownMenuItemProps {
  icon?: React.ReactElement<{ className?: string }>;
  children?: React.ReactNode;
  onClick: () => void;
  onClose?: () => void; // Received from DropdownMenu
}

export function DropdownMenuItem({ icon, children, onClick, onClose }: DropdownMenuItemProps) {
  const handleClick = () => {
    onClick();
    if (onClose) {
      onClose();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
      role="menuitem"
    >
      {icon && React.cloneElement(icon, { className: 'w-4 h-4 mr-3 text-slate-400' })}
      <span>{children}</span>
    </button>
  );
}
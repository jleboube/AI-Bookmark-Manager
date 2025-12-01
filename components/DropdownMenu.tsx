import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownMenuProps {
  trigger: React.ReactElement<React.HTMLProps<HTMLElement>>;
  children?: React.ReactNode;
}

export function DropdownMenu({ trigger, children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);
  
  // Clones the trigger to add the onClick handler
  const triggerWithHandler = React.cloneElement(trigger, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        toggleOpen();
        if (trigger.props.onClick) {
            trigger.props.onClick(e);
        }
    },
  });

  return (
    <div className="relative" ref={menuRef}>
      {triggerWithHandler}
      {isOpen && (
        <div 
            className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-md bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20 border border-slate-700 animate-fade-in"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
        >
          <div className="py-1" role="none">
             {React.Children.map(children, child =>
                React.isValidElement(child)
                  ? React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, {
                      onClose: () => setIsOpen(false),
                    })
                  : child
              )}
          </div>
        </div>
      )}
    </div>
  );
}
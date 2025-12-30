import { useEffect, useRef, useState } from "react";

type PopoverProps = {
  label?: string;
  content: React.ReactNode;
  children: React.ReactNode;
};

export default function Popover({
  label = "Info",
  content,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="popover" ref={ref}>
      <button
        className="popover__trigger"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>

      {open && (
        <div className="popover__panel">
          {content}
        </div>
      )}
    </div>
  );
}


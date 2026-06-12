import React, { useState, useEffect, useRef } from "react";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "onKeyDown"> {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
  onEnter?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function DebouncedInput({ value, onChange, delay = 300, onEnter, onKeyDown, className = "", ...props }: Props) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), delay);
  };

  const handleBlur = () => {
    clearTimeout(timer.current);
    if (local !== value) onChange(local);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      clearTimeout(timer.current);
      onChange(local);
      onEnter?.(local);
    }
    onKeyDown?.(e);
  };

  return (
    <input
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      {...props}
    />
  );
}

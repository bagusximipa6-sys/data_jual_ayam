"use client";

import { Button } from "@heroui/react";

interface KeyProps {
  label: React.ReactNode;
  onPress: () => void;
  className?: string;
}

function Key({ label, onPress, className = "" }: KeyProps) {
  return (
    <Button
      size="md"
      variant="flat"
      radius="sm"
      onPress={onPress}
      className={`h-11 min-w-0 flex-1 bg-white font-mono text-base font-black text-[#191712] border border-[#191712]/10 shadow-sm active:bg-[#d9ff67] ${className}`}
    >
      {label}
    </Button>
  );
}

interface WeighingKeypadProps {
  onAppend: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

/**
 * Keypad kalkulator di layar untuk input Data Timbangan.
 * Menyediakan karakter yang tidak tersedia di keyboard HP
 * (tanda +, -, kurung (), dll) sehingga pengguna HP tetap mudah mengetik.
 */
export function WeighingKeypad({ onAppend, onBackspace, onClear }: WeighingKeypadProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      <Key label="7" onPress={() => onAppend("7")} />
      <Key label="8" onPress={() => onAppend("8")} />
      <Key label="9" onPress={() => onAppend("9")} />
      <Key label="+" onPress={() => onAppend("+")} className="bg-[#191712] text-white" />
      <Key label="-" onPress={() => onAppend("-")} className="bg-[#191712] text-white" />
      <Key label="4" onPress={() => onAppend("4")} />
      <Key label="5" onPress={() => onAppend("5")} />
      <Key label="6" onPress={() => onAppend("6")} />
      <Key label="(" onPress={() => onAppend("(")} />
      <Key label=")" onPress={() => onAppend(")")} />
      <Key label="1" onPress={() => onAppend("1")} />
      <Key label="2" onPress={() => onAppend("2")} />
      <Key label="3" onPress={() => onAppend("3")} />
      <Key label="." onPress={() => onAppend(".")} />
      <Key label="0" onPress={() => onAppend("0")} />
      <Key label="⌫" onPress={onBackspace} className="text-lg" />
      <Key label="C" onPress={onClear} className="bg-[#ffe2d8] text-[#8f321a]" />
    </div>
  );
}


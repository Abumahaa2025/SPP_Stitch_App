import React, { createContext, useContext, useRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

type ScrollRef = RefObject<ScrollView | null>;

const Ctx = createContext<ScrollRef | null>(null);

export function KeyboardScrollProvider({
  children,
  scrollRef,
}: {
  children: React.ReactNode;
  scrollRef: ScrollRef;
}) {
  return <Ctx.Provider value={scrollRef}>{children}</Ctx.Provider>;
}

export function useKeyboardScrollRef() {
  return useContext(Ctx);
}

export function useRegisterKeyboardScroll() {
  return useRef<ScrollView>(null);
}

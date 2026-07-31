import React, { forwardRef, useCallback, useRef } from 'react';
import {
  TextInput, View, findNodeHandle, type TextInputProps,
} from 'react-native';
import { useKeyboardScrollRef } from '@/src/context/KeyboardScrollContext';

/** Scrolls parent form so the focused field stays above the keyboard. */
export const KeyboardAwareTextInput = forwardRef<TextInput, TextInputProps>(
  function KeyboardAwareTextInput({ onFocus, ...props }, ref) {
    const wrapRef = useRef<View>(null);
    const inputRef = useRef<TextInput>(null);
    const scrollRef = useKeyboardScrollRef();

    const scrollIntoView = useCallback(() => {
      const scroll = scrollRef?.current;
      const wrap = wrapRef.current;
      if (!scroll || !wrap) return;
      const scrollNode = findNodeHandle(scroll);
      if (!scrollNode) {
        scroll.scrollToEnd({ animated: true });
        return;
      }
      wrap.measureLayout(
        scrollNode,
        (_x, y) => {
          scroll.scrollTo({ y: Math.max(0, y - 100), animated: true });
        },
        () => {
          scroll.scrollToEnd({ animated: true });
        },
      );
    }, [scrollRef]);

    const handleFocus: TextInputProps['onFocus'] = (e) => {
      setTimeout(scrollIntoView, 120);
      onFocus?.(e);
    };

    return (
      <View ref={wrapRef} collapsable={false}>
        <TextInput
          ref={(r) => {
            inputRef.current = r;
            if (typeof ref === 'function') ref(r);
            else if (ref) ref.current = r;
          }}
          {...props}
          onFocus={handleFocus}
          blurOnSubmit={props.blurOnSubmit ?? false}
        />
      </View>
    );
  },
);

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Dynamic bottom inset while keyboard is visible. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      setInset(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvt, () => setInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return inset;
}

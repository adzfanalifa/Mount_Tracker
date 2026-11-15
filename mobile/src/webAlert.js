import { Alert, Platform } from 'react-native';

// Di versi web, Alert.alert dari react-native-web tidak melakukan apa-apa.
// Polyfill ini memakai window.alert / window.confirm agar alur (check-in, batal, dll.) tetap bisa dicoba di browser.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = Array.isArray(buttons) ? buttons : [];
    if (list.length > 1) {
      const cancel = list.find((b) => b.style === 'cancel');
      const action = list.filter((b) => b !== cancel).pop();
      if (window.confirm(text)) { if (action && action.onPress) action.onPress(); } else if (cancel && cancel.onPress) cancel.onPress();
    } else {
      window.alert(text);
      if (list[0] && list[0].onPress) list[0].onPress();
    }
  };
}

/** React Native's Alert with the title, message and button labels translated (src/i18n/i18n.ts). */
import { Alert as RNAlert, AlertButton, AlertOptions } from 'react-native';
import { tr } from './i18n';

const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    RNAlert.alert(tr(title), message ? tr(message) : message, buttons?.map(b => ({ ...b, text: b.text ? tr(b.text) : b.text })), options);
  },
};

export default Alert;
export { Alert };

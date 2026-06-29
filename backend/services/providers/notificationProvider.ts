import { TwilioWhatsappProvider } from './twilioWhatsappProvider';
import { MetaWhatsappProvider } from './metaWhatsappProvider';

export interface IWhatsappProvider {
  /**
   * Send a WhatsApp message
   * @param to Destination phone number (including country code, e.g. +919876543210)
   * @param message Text body content of the WhatsApp message
   */
  sendMessage(to: string, message: string): Promise<boolean>;
}

export class WhatsappProviderFactory {
  /**
   * Get the active WhatsApp provider instance based on configurations
   */
  static getProvider(): IWhatsappProvider {
    const provider = process.env.WHATSAPP_PROVIDER || 'twilio';

    if (provider.toLowerCase() === 'meta') {
      return new MetaWhatsappProvider();
    }

    // Default fallback to Twilio Sandbox / Twilio API
    return new TwilioWhatsappProvider();
  }
}

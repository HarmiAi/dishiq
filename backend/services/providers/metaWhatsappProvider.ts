import axios from 'axios';
import { IWhatsappProvider } from './notificationProvider';

export class MetaWhatsappProvider implements IWhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const accessToken = process.env.META_ACCESS_TOKEN;
      const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

      // Meta expects phone numbers without the "+" prefix
      const formattedTo = to.replace('+', '').trim();

      if (!accessToken || !phoneNumberId) {
        console.log('\n--- [MOCK META WHATSAPP OUTGOING] ---');
        console.log(`To: ${formattedTo}`);
        console.log(`Message:\n${message}`);
        console.log('-------------------------------------\n');
        return true; // Success mock fallback
      }

      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.status === 200 || response.status === 201;
    } catch (error: any) {
      console.error('Meta Cloud API Send Error details:', error.response?.data || error.message);
      return false;
    }
  }
}

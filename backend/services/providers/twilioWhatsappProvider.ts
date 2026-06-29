import axios from 'axios';
import { IWhatsappProvider } from './notificationProvider';

export class TwilioWhatsappProvider implements IWhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_TW_PHONE_NUMBER || '+14155238886'; // Default Twilio sandbox number

      // Format target phone number to exclude "+" if Twilio formatting fails, but Twilio expects "+"
      const formattedTo = to.startsWith('+') ? to : `+${to}`;

      if (!accountSid || !authToken) {
        console.log('\n--- [MOCK TWILIO WHATSAPP OUTGOING] ---');
        console.log(`To: whatsapp:${formattedTo}`);
        console.log(`From: whatsapp:${fromNumber}`);
        console.log(`Message:\n${message}`);
        console.log('----------------------------------------\n');
        return true; // Success mock fallback
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('To', `whatsapp:${formattedTo}`);
      params.append('From', `whatsapp:${fromNumber}`);
      params.append('Body', message);

      const response = await axios.post(url, params, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.status === 201 || response.status === 200;
    } catch (error: any) {
      console.error('Twilio Send Error details:', error.response?.data || error.message);
      return false;
    }
  }
}

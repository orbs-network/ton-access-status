const axios = require('axios');

// Function to send a message to the Telegram channel
async function sendMessageToTelegram(message) {
  // read at call time so dotenv load order doesn't matter
  const botToken = process.env.YOUR_BOT_TOKEN;
  const chatId = process.env.YOUR_CHANNEL_ID;
  if (!botToken || !chatId) {
    return console.error('telegram botToken and chatId are invalid. message wont send')
  }
  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
    });

    if (response.status === 200) {
      console.log('Message sent successfully.');
    } else {
      console.error('Failed to send message.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

module.exports = sendMessageToTelegram;
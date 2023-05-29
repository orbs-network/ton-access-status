const axios = require('axios');

// Define the bot token and chat ID of your Telegram channel
const botToken = process.env.YOUR_BOT_TOKEN;
const chatId = process.env.YOUR_CHANNEL_ID;

// Function to send a message to the Telegram channel
async function sendMessageToTelegram(message) {
  if (!botToken.length || !chatId.length) {
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
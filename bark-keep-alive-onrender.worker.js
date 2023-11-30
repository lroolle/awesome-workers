/**
 * bark-keep-alive-onrender.worker.js
 * Cloudflare Worker Script for Ping the Bark Server
 * Author: wrqatw@gmail.com
 * Repository: https://github.com/lroolle/awesome-workers.git
 *
 */

const barkServer = BARK_SERVER;
// const barkDeviceKey = BARK_DEVICE_KEY;

addEventListener('scheduled', (event) => {
  event.waitUntil(handleScheduledEvent(event));
});

async function handleScheduledEvent(event) {
  await pingBarkServer();
}

async function pingBarkServer() {
  // const pingUrl = `${barkServer}/${barkDeviceKey}/ping`;
  const pingUrl = `${barkServer}/ping`;
  try {
    const response = await fetch(pingUrl);
    const result = await response.text();
    console.log('Ping response:', result);
  } catch (error) {
    console.error('Error pinging Bark server:', error);
  }
}

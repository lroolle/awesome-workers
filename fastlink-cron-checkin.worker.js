/**
 * fastlink-cron-checkin.worker.js
 * Cloudflare Worker Script for Fastlink Auto Checkin
 * Author: wrqatw@gmail.com
 * Repository: https://github.com/lroolle/awesome-workers.git
 *
 */

addEventListener('scheduled', (event) => {
  event.waitUntil(handleScheduledEvent(event));
});

async function handleScheduledEvent(event) {
  try {
    const loginCookies = await login();
    if (loginCookies) {
      const homePageInfo = await checkUserHomePage(loginCookies);

      if (homePageInfo.canCheckIn) {
        const checkinMsg = await checkin(loginCookies);
        if (BARK_SERVER) {
          await sendBarkNotification(checkinMsg, homePageInfo, false);
        }
      } else {
        console.log('Already checked in for today.');
        if (BARK_SERVER) {
          await sendBarkNotification('', homePageInfo, true);
        }
      }
    } else {
      console.log('Login failed: No cookies received or login credentials are incorrect');
    }
  } catch (error) {
    console.error('Error during scheduled event:', error);
  }
}

async function login() {
  // Check if credentials are set
  if (!FASTLINK_USERNAME || !FASTLINK_PASSWORD) {
    console.error('Error: Username or Password not set in environment variables');
    return null;
  }

  const loginUrl = 'http://fastlink.pro/auth/login';
  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  };
  const email = FASTLINK_USERNAME;
  const password = FASTLINK_PASSWORD;
  const body = `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=&remember_me=on`;

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  if (response.ok) {
    let cookies = [];
    response.headers.forEach((value, name) => {
      if (name === 'set-cookie') {
        cookies.push(value.split(';')[0]);
      }
    });
    const cookiesStr = cookies.join('; ');
    console.log('Login success:', cookiesStr);
    return cookiesStr;
  } else {
    console.error('Login failed:', response.status, response.statusText);
    return null;
  }
}

async function checkin(cookies) {
  const checkinUrl = 'http://fastlink.pro/user/checkin';
  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Cookie: cookies,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  };

  const response = await fetch(checkinUrl, {
    method: 'POST',
    headers: headers,
  });

  if (response.ok) {
    const responseData = await response.json();
    return responseData.msg;
    const respText = await response.text();
    console.log('Check-in successful:', respText);
  } else {
    console.error('Check-in failed:', response.status, response.statusText);
  }
}

async function checkUserHomePage(cookies) {
  const userUrl = 'http://fastlink.pro/user';
  const headers = {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    Cookie: cookies,
  };

  const response = await fetch(userUrl, {
    method: 'GET',
    headers: headers,
  });

  if (response.ok) {
    const respText = await response.text();
    try {
      const { canCheckIn, totalTraffic, remainingTraffic, usedToday } = extractHomePageData(respText);
      console.log("User's home page info:", { canCheckIn, totalTraffic, remainingTraffic, usedToday });
      return { canCheckIn, totalTraffic, remainingTraffic, usedToday };
    } catch (e) {
      console.log("Failed to parse user's home page info: ", respText);
    }
  } else {
    console.error('Failed to access user home page:', response.status, response.statusText);
  }
}

function extractHomePageData(html) {
  let canCheckIn = !html.includes('明日再来');
  let { totalTraffic, usedToday, remainingTraffic } = extractTrafficData(html);

  return { canCheckIn, totalTraffic, usedToday, remainingTraffic };
}

function extractTrafficData(html) {
  const trafficDataRegex = /trafficDountChat\(\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',/;
  const match = trafficDataRegex.exec(html);

  if (match && match.length >= 4) {
    return {
      totalTraffic: match[1].trim(),
      usedToday: match[2].trim(),
      remainingTraffic: match[3].trim(),
    };
  }
  return { totalTraffic: '', usedToday: '', remainingTraffic: '' };
}

async function sendBarkNotification(checkinMsg, { totalTraffic, remainingTraffic, usedToday }, alreadyCheckedIn) {
  const title = 'Fastlink';
  let body;

  if (alreadyCheckedIn) {
    body = `已签到，今日已用：${usedToday}，剩余流量：${remainingTraffic}/${totalTraffic}`;
  } else {
    body = `${checkinMsg}，今日已用：${usedToday}，剩余流量：${remainingTraffic}/${totalTraffic}`;
  }

  const barkUrl = `${BARK_SERVER}/push`;
  const data = {
    title: title,
    body: body,
    group: 'fastlink',
    device_key: BARK_DEVICE_KEY,
  };

  const response = await fetch(barkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (response.ok) {
    console.log('Bark notification sent successfully');
  } else {
    const respText = await response.text();
    console.error('Failed to send Bark notification:', response.status, response.statusText, respText);
  }
}

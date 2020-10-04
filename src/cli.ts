import puppeteer from 'puppeteer-core';
import chromeLocation from 'chrome-location';
import fs from 'fs';

const persistedData = fs.existsSync(`data.json`)
  ? JSON.parse(fs.readFileSync(`data.json`, 'utf-8'))
  : { orders: [] };
const updatePersistedData = () => {
  fs.writeFileSync(`data.json`, JSON.stringify(persistedData, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'login') {
    login();
  } else if (cmd === 'update') {
    update();
  } else if (cmd === 'stats') {
    stats();
  } else {
    console.error(`usage: yarn start <login|update|stats>`);
    process.exit(1);
  }
}

async function login() {
  const profile = process.argv[3] || 'default';
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromeLocation,
    userDataDir: `data/${profile}`,
  });
  const page = await browser.newPage();
  await page.goto('https://eda.yandex.ru/moscow');
}

async function update() {
  const profiles = fs.readdirSync('./data');

  for (const profile of profiles) {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromeLocation,
      userDataDir: `data/${profile}`,
    });

    const page = await browser.newPage();
    await page.goto('https://eda.yandex.ru/moscow');
    const orders = await page.evaluate(() => {
      return fetch('/api/v1/orders').then((_) => _.json());
    });
    fs.writeFileSync(`data-${profile}.json`, JSON.stringify(orders, null, 2));

    for (const order of orders.reverse()) {
      const existed = persistedData.orders.find(
        (anOrder) => anOrder.id === order.id
      );
      if (existed) {
        Object.assign(existed, order);
      } else {
        persistedData.orders.push(order);
      }
    }

    updatePersistedData();
    browser.close();
  }
}

async function stats() {
  const { orders } = persistedData;

  let total = 0;
  for (const order of orders) {
    order.cart.items.forEach((item) => {
      total += item.price;
    });
  }

  console.log(
    `${total} rub, ${orders.length} orders, first ${
      orders[0].created_at
    }, last ${orders[orders.length - 1].created_at}`
  );
}

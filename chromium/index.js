const puppeteer = require('puppeteer');
let wsString = {};
(async () => {
    // 启动浏览器
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
            width: 1920,
            height: 800
        }
    });
    const ws = browser.wsEndpoint();
    console.log('chromium启动成功：',ws);
    return ws;
})().then(function(ws){
    wsString.url = ws;
});
module.exports = wsString;
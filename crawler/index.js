const Action = require('./action');
const wsString = require('../chromium/index');
const puppeteer = require('puppeteer');
module.exports = async (type,{url,cta,assetpath}) =>{
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsString.url
    });
    const page = await browser.newPage();
    await page.goto(url,{
        timeout: 60 * 1000,
        waitUntil: ['networkidle0']
    });
    // 等待时间久一些，保证都加载完
    // await page.waitFor(30000);
    const html = await page.evaluate(async ()=>{
        console.log('获取');
        let htmlStr = document.documentElement.outerHTML;
        console.log(htmlStr);
        return Promise.resolve(htmlStr);
    }).catch((e)=>{
        console.log(e);
    });
    await page.close();
    await browser.disconnect();
    const action = new Action(html,url,assetpath);
    action.deleteScript();// 删除script
    action.setCTA(cta);// 设置cta
    if (type === 'copy'){
        action.createDir();// 创建目录
        await action.installCss();// 生成css
        action.installImg();// 生成图片
        action.creatHtml();// 创建html文件
    }
    if (type === 'source'){
        await action.installCss(true);
        action.installImg(true);
        action.creatHtml(true);
    }
    return action.source;
};
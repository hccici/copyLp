const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');

class Action {
    dirP = '';// 当前action创建目录路径
    dirN = '';// 当前action创建目录名称
    urlParser = null;// url解析对象
    assetpath = '';// 资源前缀
    source = {
        html: '',
        link: []
    }; // 解析到的资源
    static delDir(pa){
        let files = [];
        if (fs.existsSync(pa)){
            files = fs.readdirSync(pa);
            files.forEach((file) => {
                let curPath = pa + '/' + file;
                if (fs.statSync(curPath).isDirectory()){
                    Action.delDir(curPath); // 递归删除文件夹
                } else {
                    fs.unlinkSync(curPath); // 删除文件
                }
            });
            fs.rmdirSync(pa); // 删除文件夹自身
        }
    }
    // 获取资源下载路径
    static getUrl(url1) {
        let mUrl = '';
        if (url1.startsWith('http')){
            mUrl = url1;
        } else {
            // 判断是否是跟路径，还是相对路径
            if (url1.startsWith('/')){
                mUrl = `${this.urlParser.protocol}//${this.urlParser.hostname}${url1}`;
            } else {
                // !
                let pathname = this.urlParser.pathname.endsWith('/') ? this.urlParser.pathname + 'a' : this.urlParser.pathname;
                mUrl = this.urlParser.protocol + '/' + path.resolve(`/${this.urlParser.hostname}/${pathname}`, `../${url1}`);
            }
        }
        return mUrl;
    }
    // 获取本地写入的[安装名称,资源路径]
    static getSP(pa) {
        let name = pa.split('/').pop().split('?')[0];
        name = name.split('#')[0];
        const sp = this.assetpath ? `${this.assetpath}/${this.dirN}/${name}` : name;
        return [name,sp];
    }
    static downloadSource(url1) {
        const sp = Action.getSP.call(this,url1);
        let imgUrl = Action.getUrl.call(this,url1);
        https.get(imgUrl,(res) => {
            let imgData = '';
            // 设置图片编码格式
            res.setEncoding('binary');
            // 检测请求的数据
            res.on('data', (chunk) => {
                imgData += chunk;
            });
            res.on('end', () => {
                fs.writeFile(`${this.dirP}/${sp[0]}`, imgData, 'binary', (error) => {
                    if (error) {
                        console.log(`${sp[0]}----下载失败！`);
                    } else {
                        console.log(`${sp[0]}----下载成功！`);
                    }
                });
            });
            
        }).on('error', (err) => {
            console.error(`出现错误: ${err.message}`);
        });
    }
    static isTraceImg($img) {
        if ($img.attr('width') < 10){
            $img.remove();
            return true;
        }
        return false;
    }
    constructor(html,urlString,assetpath) {
        this.$ = cheerio.load(html);
        this.urlParser = url.parse(urlString);
        this.assetpath = assetpath || '';
    }
    
    deleteScript() {
        this.$('script').remove();
    }

    createDir() {
        const name = this.urlParser.pathname.split('/');
        if (name.length !== 0){
            const t = name.pop();
            this.dirP = path.resolve(`output/${this.urlParser.hostname + '--' + t}`);
            this.dirN = `${this.urlParser.hostname + '--' + t}`;
        } else {
            this.dirP = path.resolve(`output/${this.urlParser.hostname}`);
            this.dirN = `${this.urlParser.hostname}`;
        }
        Action.delDir(this.dirP);// 如果文件存在，先清空
        fs.mkdirSync(this.dirP);
    }

    creatHtml(noInstall) {
        this.source.html = this.$.html();
        if (noInstall){
            return;
        }
        fs.writeFile(this.dirP + '/index.html',this.source.html,(err) => {
            if (err){
                console.log('html生成失败！');
            } else {
                console.log('html生成成功！');
            }
        });
    }

    installCss(noInstall) {
        const s = [];
        const doit = (i,e) => {
            const $this = this.$(e);
            const href = $this.attr('href');
            const sp = Action.getSP.call(this,href);
            // 不是css资源不操作
            if (!sp[0].endsWith('.css')){
                return;
            }
            // !引用的外部css默认不操作
            if (href.startsWith('http')){
                return;
            }
            let cssUrl = Action.getUrl.call(this,href);
            // 删除该css引用
            $this.remove();
            s.push(new Promise((resolve,reject)=>{
                https.get(cssUrl,(res)=>{
                    let cssStr = '';
                    res.on('data', (d)=>{
                        cssStr += d;
                    });
                    res.on('end',()=>{
                        // 下载css中的资源，并更改路径
                        let reg = /url\((.*?)\)/g;
                        // set 去重
                        const ap = new Set();
                        // 改变css字符串并取出要下载的资源信息
                        cssStr = cssStr.replace(reg,(m,p)=>{
                            if (p.indexOf('base64') > 0){
                                return m;
                            }
                            // 去除引号
                            let cu = p;
                            if (p.startsWith('"')){
                                let reg1 = /^"(.*)"$/;
                                cu = p.match(reg1)[1];
                            }
                            if (p.startsWith("'")){
                                let reg2 = /^'(.*)'$/;
                                cu = p.match(reg2)[1];
                            }
                            ap.add(cu);
                            const sp1 = Action.getSP.call(this,cu);
                            return `url(${sp1[1]})`;
                        });
                        // 记录要加载的css中的资源
                        this.source.link.push(...Array.from(ap).map(item=>{
                            return Action.getUrl.call(this,item);
                        }));
                        // 潜入内部css
                        console.log('已内嵌：' + cssUrl);
                        let el = this.$(`<style type="text/css">${cssStr}</style>`);
                        this.$('head').append(el);
                        resolve();
                        if (noInstall){
                            return;
                        }
                        Array.from(ap).forEach(item=>{
                            Action.downloadSource.call(this,item);
                        });
                    });
                }).on('error', (err) => {
                    console.error(`出现错误: ${err.message}`);
                    reject(err);
                });
            }));
        };
        this.$('link').each(doit);
        return Promise.all(s);
    }

    installImg(noInstall) {
        // 分两种类型的图片，一个是绝对路径，一个是相对路径的
        // 利用set去重
        const ap = new Set();
        this.$('img').each((i,e)=>{
            const $this = this.$(e);
            // ! 过滤掉那些追中转化的图片
            if (Action.isTraceImg($this) ){
                return;
            }
            // 把src-set去掉
            $this.removeAttr('srcset');
            // 保存更改之前的图片地址
            let src = $this.attr('src');
            // ! 其他网站的图片先保留，应该爬不了的情况挺多
            if (src.startsWith('http')){
                return;
            }
            // ! base64的图片不动
            if (src.indexOf('base64') > 0){
                return;
            }
            // 更改图片地址
            const sp = Action.getSP.call(this,src);
            $this.attr('src',sp[1]);
            ap.add(src);
        });
        // 加载title上的icon
        let favicon = this.$('link[rel="icon"]');
        if (favicon){
            let href = favicon.attr('href');
            ap.add(href);
            favicon.attr('href',Action.getSP.call(this,href)[1]);
        }
        // 记录要加载的资源
        this.source.link.push(...Array.from(ap).map(item=>{
            return Action.getUrl.call(this,item);
        }));
        if (noInstall){
            return;
        }
        let time = 1;
        Array.from(ap).forEach((item)=>{
            // 图片数量较多，延迟请求
            setTimeout(()=>{
                Action.downloadSource.call(this, item);
            },time);
            time += 50;
        });
    }

    setCTA(setUrl) {
        const map = {};
        this.$('a').each((i,e)=>{
            const href = this.$(e).attr('href');
            if (map[href] >= 1){
                map[href] += 1;
            } else {
                map[href] = 1;
            }
        });
        // ! 最多的判断为cta地址
        let temp = null;
        for (let key in map){
            if (!temp){
                temp = [key, map[key]];
                continue;
            } else if (temp[1] < map[key]){
                temp = [key, map[key]];
            }
        }
        let ctaUrl = temp[0];
        this.$(`a[href="${ctaUrl}"]`).attr('href',setUrl);
        console.log(`判断cta为：${ctaUrl}，出现了${temp[1]}，替换为：${setUrl}`);
    }
}
module.exports = Action;
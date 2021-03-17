const copy = require('../../crawler/index');
class Controller {
    copyLandingPage (ctx) {
        copy('copy', ctx.request.body);
        ctx.body = {
            message: 'copy中，请等待1到2分钟'
        };
    }
    async getSource (ctx) {
        const data = await copy('source', ctx.request.body);
        ctx.body = {
            message: 'data中是要下载的资源',
            data
        };
    }
}
module.exports = new Controller();
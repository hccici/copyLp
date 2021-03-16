const Koa = require('koa2');
const koaBody = require('koa-body');
const cors = require('koa2-cors');
const app = new Koa();
const router = require('./router/index');
app.use(koaBody());
app.use(cors());
app.use(router.routes());
app.listen(3000,()=>{
    console.log('启动成功');
});
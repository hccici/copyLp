const Router = require('koa-router');
const ctr = require('../controller/index');
const router = new Router();
router.post('/', ctr.copyLandingPage);
router.post('/source', ctr.getSource);
module.exports = router;
const express = require('express')
const app = express()
const status = require('./status');

const port = process.env.PORT || 3000;
//const port = 8080;

//set view engine
app.set('views', './views');
app.set("view engine", "jade")

app.use(express.static('css'));

app.get('/', async function (req, res) {
    await status.update();
    res.render('status', status.data);
});

app.get('/update', async function (req, res) {
    // refresh every time
    await status.update();
    res.send('update completed');
});

app.get('/json', async function (req, res) {
    await status.update();
    res.json(status.data);
});

// start monitor status
status.start();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})
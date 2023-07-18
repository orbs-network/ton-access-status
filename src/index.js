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
    status.needUpdate = true;
    res.render('status', status.data);
});

app.get('/api', async function (req, res) {
    res.render('api');
});


app.get('/json', async function (req, res) {
    status.needUpdate = true;
    res.json(status.data);
});

// start monitor status
status.start();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})

// this catched the exception thrown by lite client.
process.on('uncaughtException', function (err) {
    // Handle the error safely
    // TOO MUCH LOGS console.log('uncaughtException:', err);
});
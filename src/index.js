const express = require('express')
const app = express()
const status = require('./status');

const port = process.env.PORT || 3000;

//set view engine
app.set('views', './views');
app.set("view engine", "jade")

app.get('/', function (req, res) {
    res.render('sample');
});

app.use(express.static('css'));

app.get('/status', function (req, res) {
    res.render('status', status.get());
});

// start monitor status
status.monitor();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
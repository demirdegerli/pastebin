const express = require("express");
const app = express();
const Handlebars = require("hbs");

const { QuickDB } = require("quick.db");
const db = new QuickDB();

const aes256 = require("aes256");

// save data to database
async function dbset(key, value) {
  await db.set(key, value)
}
// get data from database
async function dbget(key) {
  return await db.get(key)
}
// is database has data
async function dbhas(key) {
  return await db.has(key)
}
// get all data from database
async function dball() {
  return await db.all()
}

function decrypt(key, hash) {
  try {
  return aes256.decrypt(key, hash)
  } catch {
    return hash;
  }
}

app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.get("/", (req, res) => {
    res.render(__dirname+"/"+"index.hbs", {c:""});
})
app.post("/", async (req, res) => {
    let key = false;
    if(!req.body.content) return res.render(__dirname+"/"+"index.hbs", {c:"Content cannot be empty."})
    if(req.body.content.length > 100000) return res.render(__dirname+"/"+"index.hbs", {c:`Character limit exceeded! (100000)`});
    if(req.body.encrypt === "on") {
      key = Math.random().toString(36).slice(-10)+Math.random().toString(36).slice(-10)+Math.random().toString(36).slice(-10);
      req.body.content = aes256.encrypt(key, req.body.content);
    }
    let random = Math.random().toString(36).slice(-8)
    do {
      random = Math.random().toString(36).slice(-8)
    } while (await dbhas(random))
    await dbset(random, req.body.content)
  res.redirect(`//${req.headers["x-forwarded-host"] ? req.headers["x-forwarded-host"] : req.headers.host}/${random}${key?'?key='+key:''}`)
})

app.get("/style.css", (_, res) => {
    res.sendFile(__dirname+"/"+"style.css")
})
app.get("/highlight.min.css", (_, res) => {
    res.sendFile(__dirname+"/"+"highlight.min.css")
})
app.get("/highlight.min.js", (_, res) => {
    res.sendFile(__dirname+"/"+"highlight.min.js")
})

app.get("/raw/:paste", async (req, res) => {
    if(req.params.paste && await dbhas(req.params.paste)) {
      var output = await dbget(req.params.paste);
      if(req.query.key) {
        output = decrypt(req.query.key, output);
      }
        res.type('text/plain')
        res.send(output)
    } else {
        res.send("Not found.")
    }
})

app.get("/:paste", async (req, res) => {
    if(req.params.paste && await dbhas(req.params.paste)) {
      var output = await dbget(req.params.paste);
      var raw = `//${req.headers["x-forwarded-host"] ? req.headers["x-forwarded-host"] : req.headers.host}/raw/${req.params.paste}`;
      if(req.query.key) {
        output = decrypt(req.query.key, output);
        raw += `?key=${req.query.key}`
      }
        res.render(__dirname+"/"+"paste.hbs", {
            c: output,
            r: raw
        })
    } else {
        res.render(__dirname+"/"+"error.hbs", {c:"Not found."})
    }
})

var listener = app.listen(80, async () => {
    console.log(`Server is listening on http(s)://${listener.address().address}:${listener.address().port} (${listener.address().family})`)
});
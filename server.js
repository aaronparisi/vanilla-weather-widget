const http = require('http')
const https = require('https')
const process = require('process')

// server params
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || '3000'
let masterHtml,
  weatherDataCache = {}

// Response params
const COMMON_RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Max-Age': 2592000, // 30 days
  'Content-Type': 'application/json',
}
const CONTENT_TYPE = {
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json'
}

// Errors
const FAILED = 'request failed'
const BAD_REQUEST = 'bad request'
const INVALID_RESPONSE = 'invalid response'
const INVALID_KEY = 'invalid key'

// Misc
class RequestError extends Error {
  constructor(msg, res, json) {
    super(msg)
    this.statusCode = res.statusCode
    this.method = res.req?.method
    this.host = res.req?.host
    this.path = res.req?.path
    this.json = json ?? ''
  }

  toString() {
    return `${this.message} ${this.statusCode} ${this.method} ${this.host} ${this.path} ${this.json}`
  }
}

// HTML pages
const renderMaster = ({links = '', scripts = '', main = '', nav}) => {
  return /*html*/`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Vanilla Weather Widget</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="utf-8">
        ${links}
        ${scripts}
      </head>
      <body>${main}</body>
    </html>`
}
const renderWeatherWidget = ({links = '', scripts = '', main = '', nav}) => {
  return /*html*/`
    <p>${JSON.stringify(weatherDataCache)}</p>
    <img src="http://openweathermap.org/img/wn/${weatherDataCache.weather[0].icon}.png">
  `
}

const log = (msg, level = 'INFO') => {
  let s = '[' + new Date().toISOString() + '|' + level + '] ' + msg
  if (level === 'ERROR') console.error("\x1b[31m", s, "\x1b[0m")
  else console.log(s)
}
const requestLogger = req => (msg, level) => log(req.url + ' :: ' + msg, level)

// Server functions
const getWeatherData = () => {
    return new Promise((resolve, reject) => {
      https.get(
        'https://api.openweathermap.org/data/2.5/weather?lat=47.61&lon=-122.33&appid=40df66ccc657491b4b7216bb131ebb41',
        res => {
          if (res.statusCode === 401) reject(new RequestError(INVALID_KEY, res))
          if (res.statusCode !== 200) reject(new RequestError(BAD_REQUEST, res))
          // log('back from getting weather')
          let json = ''
          res.on('data', chunk => json += chunk)
          res.on('end', () => {
            try {
              resolve(JSON.parse(json))
            } catch (error) {
              reject(new RequestError(INVALID_RESPONSE, res, json))
            }
          })
        }
      ).on('error', error => new RequestError(FAILED, error))
  })
}
const respond = (res, data = "", contentType = CONTENT_TYPE.html, statusCode = 200) => {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(data)
  })
  res.end(data)
}
const handleRequest = (req, res) => {
  req.log = requestLogger(req)

  const baseUrl = req.protocol + "://" + req.host
  req.parsedUrl = new URL(req.url, baseUrl) // TODO codify base url(s)

  req.log('New Request')

  respond(res, masterHtml)
}
const main = () => {
  const server = http.createServer(handleRequest)

  getWeatherData()
    .then(json => {
      weatherDataCache = json
      masterHtml = renderMaster({
        links: `<link rel="stylesheet" href="./index.css">`,
        scripts: ``,
        main: renderWeatherWidget({})
      })

      server.listen(PORT, HOST, () => {
        log(`Server is listening on ${HOST}:${PORT}`)
      })
    })

  const exit = () => {
    server.close(() => process.exit())
    // todo caching clear
  }

  process.on('SIGINT', exit)
  process.on('SIGTERM', exit)

  process.on('uncaughtException', (err, origin) => {
    log(`Process caught unhandled exception ${err} ${origin}`, 'ERROR')
  })
}

main()

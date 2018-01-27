#!/usr/bin/env node
import {parse as parseUrl} from 'url'
import {IncomingMessage, ServerResponse, createServer} from 'http'
import * as optimist from 'optimist'
import {logger, Level} from 'loge'
import Router from 'regex-router'

import {Program, Kiosk, Status, db} from './database'
const package_json = require('./package.json')

function sendError(res: ServerResponse, error: Error): ServerResponse {
  res.statusCode = 400
  res.setHeader('Content-Type', 'text/plain')
  const body = `${error.name}: ${error.message}`
  res.end(body)
  return res
}

function sendJson(res: ServerResponse, object: any): ServerResponse {
  res.setHeader('Content-Type', 'application/json')
  let body = ''
  try {
    body = JSON.stringify(object)
  }
  catch (exc) {
    body = JSON.stringify(`JSON serialization error: ${exc.toString()}`)
  }
  res.end(body)
  return res
}

const R = new Router()

R.get(/^\/statuses(\?|$)/, (req, res) => {
  const urlObj = parseUrl(req.url, true)

  let query = db.Select('status INNER JOIN kiosk ON kiosk.id = status.kiosk_id')
                .add('kiosk.bcycle_id', 'kiosk.name', 'kiosk.description',
                     'kiosk.street', 'kiosk.city', 'kiosk.state', 'kiosk.zip_code', 'kiosk.country',
                     'kiosk.latitude', 'kiosk.longitude', 'kiosk.time_zone', 'kiosk.status', 'kiosk.is_event_based',
                     'status.docks_available', 'status.bikes_available', 'status.fetched')
                .orderBy('fetched DESC')

  if (urlObj.query.programId) {
    // if you specify a particular program, you get a whole day's worth
    const program_id = parseInt(urlObj.query.programId as string, 10)
    const now = new Date()
    const one_day_ago = new Date(now.getTime() - 24*60*60*1000)
    query = query.whereEqual({program_id}).where('fetched > ?', one_day_ago)
  }
  else {
    // if you don't specify a program, you only get the last 1000
    const limit = Math.min(parseInt(urlObj.query.limit as string || '1000', 10), 1000)
    query = query.limit(limit)
  }

  query.execute((error: Error, statuses: Status[]) => {
    if (error) return sendError(res, error)

    sendJson(res, statuses)
  })
})

R.get(/^\/programs(\?|$)/, (req, res) => {
  db.Select('program INNER JOIN kiosk ON kiosk.program_id = program.id')
    .add('program.id', 'program.name', 'program.latitude', 'program.longitude', 'program.last_fetched',
         // ::integer converts from long so that `pg` parses it as a number
         'COUNT(kiosk.id)::integer AS kiosks')
    .orderBy('program.name')
    .groupBy('program.id')
    .execute((error: Error, programs: Program[]) => {
      if (error) return sendError(res, error)

      sendJson(res, programs)
    })
})

/** GET /info
Show bcycle package metadata
*/
R.get(/^\/info$/, (req, res, m) => {
  const {name, version, description, homepage, author, license} = package_json
  sendJson(res, {name, version, description, homepage, author, license})
})

const server = createServer((req, res) => {
  logger.debug('%s %s', req.method, req.url)
  // enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', '*')
  R.route(req, res)
})
server.on('listening', () => {
  const address = server.address()
  logger.info(`server listening on http://${address.address}:${address.port}`)
})

function main() {
  const argvparser = optimist.usage(`Usage: npm start [options]

    Start the HTTP API server`)
  .describe({
    help: 'print this help message',
    verbose: 'print extra output',
    version: 'print version',
  })
  .boolean(['help', 'verbose', 'version'])
  .default({
    hostname: process.env.HOSTNAME || '127.0.0.1',
    port: parseInt(process.env.PORT, 10) || 80,
    verbose: process.env.DEBUG !== undefined,
  })

  const argv = argvparser.argv
  logger.level = argv.verbose ? Level.debug : Level.info

  if (argv.help) {
    argvparser.showHelp()
  }
  else if (argv.version) {
    console.log(require('./package').version)
  }
  else {
    server.listen(argv.port, argv.hostname)
  }
}

if (require.main === module) {
  main()
}

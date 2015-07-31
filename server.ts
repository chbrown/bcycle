/// <reference path="type_declarations/index.d.ts" />
var http = require('http-enhanced');
var logger = require('loge');
import url = require('url');
import moment = require('moment');
import Router = require('regex-router');

import {Program, Kiosk, Status, db} from './database';
var package_json = require('./package.json');

var R = new Router();

R.get(/^\/statuses(\?|$)/, (req, res: any) => {
  var urlObj = url.parse(req.url, true);

  var query = db.Select('status INNER JOIN kiosk ON kiosk.id = status.kiosk_id')
  .add([
    'kiosk.bcycle_id', 'kiosk.name', 'kiosk.description',
    'kiosk.street', 'kiosk.city', 'kiosk.state', 'kiosk.zip_code', 'kiosk.country',
    'kiosk.latitude', 'kiosk.longitude', 'kiosk.time_zone', 'kiosk.status', 'kiosk.is_event_based',
    'status.docks_available', 'status.bikes_available', 'status.fetched',
  ])
  .orderBy('fetched DESC')

  if (urlObj.query.programId) {
    // if you specify a particular program, you get a whole day's worth
    var program_id = parseInt(urlObj.query.programId, 10);
    var one_day_ago = (new Date().getTime())
    query = query
      .whereEqual({program_id: program_id})
      .where('fetched > ?', moment().subtract(1, 'day').toDate());
  }
  else {
    // if you don't specify a program, you only get the last 1000
    var limit = Math.min(parseInt(urlObj.query.limit || 1000, 10), 1000);
    query = query.limit(limit);
  }

  query.execute((error: Error, statuses: Status[]) => {
    if (error) return res.error(error);

    res.json(statuses);
  });
});

R.get(/^\/programs(\?|$)/, (req, res: any) => {
  db.Select('program INNER JOIN kiosk ON kiosk.program_id = program.id')
  .add([
    'program.id', 'program.name', 'program.latitude', 'program.longitude', 'program.last_fetched',
    // ::integer converts from long so that `pg` parses it as a number
    'COUNT(kiosk.id)::integer AS kiosks',
  ])
  .orderBy('program.name')
  .groupBy('program.id')
  .execute((error: Error, programs: Program[]) => {
    if (error) return res.error(error);

    res.json(programs);
  });
});

/** GET /info
Show bcycle package metadata
*/
R.get(/^\/info$/, (req, res: any, m) => {
  var info = {
    name: package_json.name,
    version: package_json.version,
    description: package_json.description,
    homepage: package_json.homepage,
    author: package_json.author,
    license: package_json.license,
  };
  res.json(info);
});

var server = http.createServer((req, res) => {
  logger.debug('%s %s', req.method, req.url);
  // enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  R.route(req, res);
});
server.on('listening', () => {
  var address = server.address();
  logger.info(`server listening on http://${address.address}:${address.port}`);
});

export = server;

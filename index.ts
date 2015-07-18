/// <reference path="type_declarations/node/node.d.ts" />
/// <reference path="type_declarations/async/async.d.ts" />
/// <reference path="type_declarations/request/request.d.ts" />
import path = require('path');
import child_process = require('child_process');
import async = require('async');
import request = require('request');

var logger = require('loge');
var sqlcmd = require('sqlcmd-pg');

var db = new sqlcmd.Connection({
  host: '127.0.0.1',
  port: '5432',
  user: 'postgres',
  database: 'bcycle',
});

interface Station {
  id?: number; // PK

  title: string;       // "East 6th at Robert Martinez"
  description: string; // "",
  address: string;     // "2120 East 6th St\nAustin, TX 78702",

  latitude: number;    // 30.26032,
  longitude: number;   // -97.71899000000002,

  has_trikes: boolean;  // false,
}

interface Status {
  id?: number; // PK
  station_id?: number; // FK

  bikes: number;       // 5,
  docks: number;       // 8,
  icon: string;        // "marker-active",
  back: string;        // "markerAvailable",
}

interface StationStatus extends Station, Status { }

function storeStation(station: Station, callback: (error: Error, station?: Station) => void) {
  db.SelectOne('station')
  .whereEqual({
    title: station.title,
    address: station.address,
  })
  .execute((error: Error, existing_station: Station) => {
    if (error) return callback(error);
    if (existing_station) {
      return callback(null, existing_station);
    }
    db.InsertOne('station')
    .set({
      title: station.title,
      description: station.description,
      address: station.address,
      latitude: station.latitude,
      longitude: station.longitude,
      has_trikes: station.has_trikes,
    })
    .returning('*')
    .execute(callback);
  });
}

export function fetchStationStatuses(url: string, callback: (error: Error, station_statuses?: StationStatus[]) => void) {
  var phantomjs_script = path.join(__dirname, 'fetch.js');
  child_process.execFile('phantomjs', ['--ignore-ssl-errors', 'true', phantomjs_script, url], function(error, stdout, stderr) {
    if (error) return callback(error);
    if (stderr) {
      logger.error('phantomjs stderr:', stderr.toString());
    }
    callback(null, JSON.parse(<any>stdout));
  });
}

function storeStationStatuses(station_statuses: StationStatus[], callback: (error: Error) => void) {
  async.each(station_statuses, (station_status: StationStatus, callback: (error: Error) => void) => {
    storeStation(station_status, (error: Error, station: Station) => {
      if (error) return callback(error);
      db.InsertOne('status')
      .set({
        station_id: station.id,
        bikes: station_status.bikes,
        docks: station_status.docks,
        icon: station_status.icon,
        back: station_status.back,
      })
      .execute(callback);
    });
  }, callback);
}

export function watch(url: string, interval_ms: number, callback: (error: Error) => void) {
  db.createDatabaseIfNotExists(function(error) {
    if (error) return callback(error);

    var migrations_dirpath = path.join(__dirname, 'migrations');
    db.executePatches('_migrations', migrations_dirpath, function(err) {
      if (error) return callback(error);

      setInterval(() => {
        logger.info('[%s] Fetching stations-locations', new Date().toISOString());
        fetchStationStatuses(url, (error, station_statuses) => {
          if (error) return callback(error);

          storeStationStatuses(station_statuses, (error) => {
            if (error) return callback(error);

            logger.info('Done fetching');
          });
        });
      }, interval_ms);
    });
  });
}

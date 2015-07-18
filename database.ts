/// <reference path="type_declarations/node/node.d.ts" />
/// <reference path="type_declarations/async/async.d.ts" />
import path = require('path');
import async = require('async');
var logger = require('loge');
var sqlcmd = require('sqlcmd-pg');

import {Program as PublicAPIProgram, Kiosk as PublicAPIKiosk, PublicAPI} from 'publicapi';

export var db = new sqlcmd.Connection({
  host: '127.0.0.1',
  port: '5432',
  user: 'postgres',
  database: 'bcycle',
});

// attach local logger to sqlcmd.Connection log events
db.on('log', function(ev) {
  var args = [ev.format].concat(ev.args);
  logger[ev.level].apply(logger, args);
});

export function initialize(callback: (error: Error) => void) {
  db.createDatabaseIfNotExists(error => {
    if (error) return callback(error);

    var migrations_dirpath = path.join(__dirname, 'migrations');
    db.executePatches('_migrations', migrations_dirpath, callback);
  });
}

// these interfaces represent the database tables
interface Program {
  id: number; // PK
  bcycle_program_id: number;
  name: string;
  latitude: number;
  longitude: number;
  url?: string;
  created: Date;
}
interface Kiosk {
  id: number; // PK
  program_id: number; // FK
  bcycle_id: number;
  name: string;
  description: string;
  street: string;
  city: string;
  state?: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  time_zone: string;
  status: string;
  is_event_based: boolean;
  created: Date;
}
interface Status {
  id: number; // PK
  kiosk_id: number; // FK
  docks_available: number;
  bikes_available: number;
  fetched: Date;
}

/**
Give it a PublicAPI Program object, get back an instantiated local database Program.
*/
function findOrCreateProgram(program: PublicAPIProgram, callback: (error: Error, program?: Program) => void) {
  logger.debug('findOrCreateProgram: %j', program);
  db.SelectOne('program')
  .whereEqual({bcycle_program_id: program.ProgramId})
  .execute((error: Error, existing_program: Program) => {
    if (error) return callback(error);
    if (existing_program) {
      return callback(null, existing_program);
    }
    db.InsertOne('program')
    .set({
      bcycle_program_id: program.ProgramId,
      name: program.Name,
      latitude: program.MapCenter.Latitude,
      longitude: program.MapCenter.Longitude,
    })
    .returning('*')
    .execute(callback);
  });
}

/**
Give it a PublicAPI Kiosk object, get back an instantiated local database Kiosk.

The given program_id should be an internal `program` table `id` value.
*/
function findOrCreateKiosk(kiosk: PublicAPIKiosk,
                           program_id: number,
                           callback: (error: Error, kiosk?: Kiosk) => void) {
  db.SelectOne('kiosk')
  .whereEqual({bcycle_id: kiosk.Id})
  .execute((error: Error, existing_kiosk: Kiosk) => {
    if (error) return callback(error);
    if (existing_kiosk) {
      return callback(null, existing_kiosk);
    }
    db.InsertOne('kiosk')
    .set({
      bcycle_id: kiosk.Id,
      program_id: program_id,
      name: kiosk.Name,
      description: kiosk.PublicText,
      street: kiosk.Address.Street,
      city: kiosk.Address.City,
      state: kiosk.Address.State, // may be null
      zip_code: kiosk.Address.ZipCode,
      country: kiosk.Address.Country,
      latitude: kiosk.Location.Latitude,
      longitude: kiosk.Location.Longitude,
      time_zone: kiosk.TimeZone,
      status: kiosk.Status,
      is_event_based: kiosk.IsEventBased,
    })
    .returning('*')
    .execute(callback);
  });
}

export function fetchNext(public_api: PublicAPI, callback: (error?: Error) => void) {
  // find which program is the oldest
  db.SelectOne('program_last_fetched')
  .orderBy("COALESCE(last_fetched, '1970-01-01')")
  .execute((error: Error, program: Program) => {
    if (error) return callback(error);

    logger.debug(`[${new Date().toISOString()}] fetchNext: program.id=${program.id}`);

    public_api.listProgramKiosks(program.bcycle_program_id, (error, public_api_kiosks) => {
      if (error) return callback(error);

      async.each(public_api_kiosks, (public_api_kiosk, callback) => {
        findOrCreateKiosk(public_api_kiosk, program.id, (error, kiosk) => {
          if (error) return callback(error);

          db.InsertOne('status')
          .set({
            kiosk_id: kiosk.id,
            docks_available: public_api_kiosk.DocksAvailable,
            bikes_available: public_api_kiosk.BikesAvailable,
          })
          .execute(callback);
        });
      }, error => {
        if (error) return callback(error);

        logger.debug(`[${new Date().toISOString()}] fetchNext: inserting ${public_api_kiosks.length} statuses`);
        callback();
      });
    });
  });
}

export function fetchPrograms(public_api: PublicAPI, callback: (error: Error) => void) {
  public_api.listPrograms((error, programs) => {
    if (error) return callback(error);

    async.each(programs, findOrCreateProgram, callback);
  });
}

export function loop(public_api: PublicAPI, interval_ms: number, callback: (error: Error) => void) {
  setInterval(() => {
    fetchNext(public_api, error => {
      if (error) return callback(error);
      // if there's an error, we leak the interval, but we're gonna exit anyway,
      // so it's not a big deal
    });
  }, interval_ms);
}

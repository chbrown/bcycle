import * as async from 'async'
import {join} from 'path'
import {logger} from 'loge'
import {executePatches} from 'sql-patch'
import {Connection} from 'sqlcmd-pg'

import {Program as PublicAPIProgram, Kiosk as PublicAPIKiosk, PublicAPI} from './publicapi'

export const db = new Connection({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  database: 'bcycle',
})

// attach local logger to sqlcmd.Connection log events
db.on('log', ev => {
  const args = [ev.format].concat(ev.args)
  logger[ev.level].apply(logger, args)
})

export function initialize(callback: (error: Error) => void) {
  db.createDatabaseIfNotExists(error => {
    if (error) return callback(error)

    const migrations_dirpath = join(__dirname, 'migrations')
    executePatches(db, '_migrations', migrations_dirpath, callback)
  })
}

// these interfaces represent the database tables
export interface Program {
  id: number // PK
  bcycle_program_id: number
  name: string
  latitude: number
  longitude: number
  url?: string
  created: Date
}
export interface Kiosk {
  id: number // PK
  program_id: number // FK
  bcycle_id: number
  name: string
  description: string
  street: string
  city: string
  state?: string
  zip_code: string
  latitude: number
  longitude: number
  time_zone: string
  status: string
  is_event_based: boolean
  created: Date
}
export interface Status {
  id: number // PK
  kiosk_id: number // FK
  docks_available: number
  bikes_available: number
  fetched: Date
}

/**
Give it a PublicAPI Program object, get back an instantiated local database Program.
*/
function findOrCreateProgram(program: PublicAPIProgram, callback: (error: Error, program?: Program) => void) {
  logger.debug('findOrCreateProgram: %j', program)
  db.SelectOne('program')
  .whereEqual({bcycle_program_id: program.ProgramId})
  .execute((error: Error, existing_program: Program) => {
    if (error) return callback(error)
    if (existing_program) {
      return callback(null, existing_program)
    }
    db.InsertOne('program')
    .set({
      bcycle_program_id: program.ProgramId,
      name: program.Name,
      latitude: program.MapCenter.Latitude,
      longitude: program.MapCenter.Longitude,
    })
    .returning('*')
    .execute(callback)
  })
}

/**
Give it a PublicAPI Kiosk object, get back an instantiated local database Kiosk.

The given program_id should be an internal `program` table `id` value.
*/
function findOrCreateKiosk(kiosk: PublicAPIKiosk,
                           program_id: number,
                           callback: (error: Error, kiosk?: Kiosk) => void) {
  db.SelectOne('kiosk')
  .whereEqual({
    program_id: program_id,
    bcycle_id: kiosk.Id,
  })
  .execute((error: Error, existing_kiosk: Kiosk) => {
    if (error) return callback(error)
    if (existing_kiosk) {
      return callback(null, existing_kiosk)
    }
    db.InsertOne('kiosk')
    .set({
      program_id: program_id,
      bcycle_id: kiosk.Id,
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
    .execute(callback)
  })
}

export function fetchNext(public_api: PublicAPI, callback: (error?: Error) => void) {
  // find which program is the oldest and update it in one go.
  // this is not entirely race-condition free, but pretty close!
  db.query(`UPDATE program AS t1 SET last_fetched = NOW()
    FROM (SELECT * FROM program ORDER BY last_fetched LIMIT 1) AS t2
    WHERE t1.id = t2.id
    RETURNING *`, [], (error: Error, programs: Program[]) => {
    if (error) return callback(error)

    const program = programs[0]

    logger.debug(`[${new Date().toISOString()}] fetchNext: program.id=${program.id}`)

    public_api.listProgramKiosks(program.bcycle_program_id, (error, public_api_kiosks) => {
      if (error) return callback(error)

      async.eachLimit(public_api_kiosks, 10, (public_api_kiosk, callback) => {
        findOrCreateKiosk(public_api_kiosk, program.id, (error, kiosk) => {
          if (error) return callback(error)

          db.InsertOne('status')
          .set({
            kiosk_id: kiosk.id,
            docks_available: public_api_kiosk.DocksAvailable,
            bikes_available: public_api_kiosk.BikesAvailable,
          })
          .execute(callback)
        })
      }, error => {
        if (error) return callback(error)

        logger.debug(`[${new Date().toISOString()}] fetchNext: inserting ${public_api_kiosks.length} statuses`)
        callback()
      })
    })
  })
}

export function fetchPrograms(public_api: PublicAPI, callback: (error: Error) => void) {
  public_api.listPrograms((error, programs) => {
    if (error) return callback(error)

    async.each(programs, findOrCreateProgram, callback)
  })
}

export function loop(public_api: PublicAPI, interval_ms: number, callback: (error: Error) => void) {
  setInterval(() => {
    fetchNext(public_api, error => {
      if (error) return callback(error)
      // if there's an error, we leak the interval, but we're gonna exit anyway,
      // so it's not a big deal
    })
  }, interval_ms)
}

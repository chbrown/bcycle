#!/usr/bin/env node
import {logger, Level} from 'loge'
import {createAndRunMigrations, fetchPrograms, fetchNext, db} from './database'

/** Initialize the database and fetch current programs */
function initialize(ApiKey: string, callback: (error?: Error) => void) {
  createAndRunMigrations(error => {
    if (error) throw error
    fetchPrograms(ApiKey, error => {
      if (error) throw error
      // delete the program with no kiosks
      db.Delete('program')
      .whereEqual({bcycle_program_id: 49})
      .execute(error => {
        if (error) callback(error)
        logger.info('Done with initialization')
        callback()
      })
    })
  })
}

function main() {
  const argvparser = require('optimist')
  .usage('Usage: bcycle-fetch [options]')
  .describe({
    key: 'B-cycle API key',
    interval: 'repeatedly perform next fetch task, waiting `interval` milliseconds between fetches while watching',
    help: 'print this help message',
    verbose: 'print extra output',
    version: 'print version',
  })
  .boolean(['help', 'verbose', 'version'])
  .default({
    key: process.env.BCYCLE_API_KEY,
    // interval: 60*1000, // every 60 seconds
    verbose: process.env.DEBUG !== undefined,
  })

  let argv = argvparser.argv
  logger.level = argv.verbose ? Level.debug : Level.info

  if (argv.help) {
    argvparser.showHelp()
  }
  else if (argv.version) {
    console.log(require('./package').version)
  }
  else {
    argv = argvparser.demand('key').argv
    const ApiKey = argv.key
    initialize(ApiKey, error => {
      if (error) throw error

      // fork logic based on if we are looping or not
      if (argv.interval) {
        // continuously fetch until we can't fetch no more :(
        // Periodically fetch each program's kiosk statuses and store them in the database
        setInterval(() => {
          fetchNext(ApiKey, error => {
            if (error) throw error
            // if there's an error, we leak the interval,
            // but we're gonna exit anyway, so it's not a big deal
            process.exit(1)
          })
        }, argv.interval)
      }
      else {
        // fetch once and exit
        // Fetch the next (last fetched) kiosk statuses and store them in the database
        fetchNext(ApiKey, error => {
          if (error) throw error
          // otherwise, consider it a success
          process.exit(0)
        })
      }
    })
  }
}

if (require.main === module) {
  main()
}

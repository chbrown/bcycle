/// <reference path="type_declarations/node/node.d.ts" />
/// <reference path="type_declarations/async/async.d.ts" />
var path = require('path');
var async = require('async');
var logger = require('loge');
var sqlcmd = require('sqlcmd-pg');
exports.db = new sqlcmd.Connection({
    host: '127.0.0.1',
    port: '5432',
    user: 'postgres',
    database: 'bcycle',
});
// attach local logger to sqlcmd.Connection log events
exports.db.on('log', function (ev) {
    var args = [ev.format].concat(ev.args);
    logger[ev.level].apply(logger, args);
});
function initialize(callback) {
    exports.db.createDatabaseIfNotExists(function (error) {
        if (error)
            return callback(error);
        var migrations_dirpath = path.join(__dirname, 'migrations');
        exports.db.executePatches('_migrations', migrations_dirpath, callback);
    });
}
exports.initialize = initialize;
/**
Give it a PublicAPI Program object, get back an instantiated local database Program.
*/
function findOrCreateProgram(program, callback) {
    logger.debug('findOrCreateProgram: %j', program);
    exports.db.SelectOne('program')
        .whereEqual({ bcycle_program_id: program.ProgramId })
        .execute(function (error, existing_program) {
        if (error)
            return callback(error);
        if (existing_program) {
            return callback(null, existing_program);
        }
        exports.db.InsertOne('program')
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
function findOrCreateKiosk(kiosk, program_id, callback) {
    exports.db.SelectOne('kiosk')
        .whereEqual({ bcycle_id: kiosk.Id })
        .execute(function (error, existing_kiosk) {
        if (error)
            return callback(error);
        if (existing_kiosk) {
            return callback(null, existing_kiosk);
        }
        exports.db.InsertOne('kiosk')
            .set({
            bcycle_id: kiosk.Id,
            program_id: program_id,
            name: kiosk.Name,
            description: kiosk.PublicText,
            street: kiosk.Address.Street,
            city: kiosk.Address.City,
            state: kiosk.Address.State,
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
function fetchNext(public_api, callback) {
    // find which program is the oldest
    exports.db.SelectOne('program_last_fetched')
        .orderBy("COALESCE(last_fetched, '1970-01-01')")
        .execute(function (error, program) {
        if (error)
            return callback(error);
        logger.debug("[" + new Date().toISOString() + "] fetchNext: program.id=" + program.id);
        public_api.listProgramKiosks(program.bcycle_program_id, function (error, public_api_kiosks) {
            if (error)
                return callback(error);
            async.each(public_api_kiosks, function (public_api_kiosk, callback) {
                findOrCreateKiosk(public_api_kiosk, program.id, function (error, kiosk) {
                    if (error)
                        return callback(error);
                    exports.db.InsertOne('status')
                        .set({
                        kiosk_id: kiosk.id,
                        docks_available: public_api_kiosk.DocksAvailable,
                        bikes_available: public_api_kiosk.BikesAvailable,
                    })
                        .execute(callback);
                });
            }, function (error) {
                if (error)
                    return callback(error);
                logger.debug("[" + new Date().toISOString() + "] fetchNext: inserting " + public_api_kiosks.length + " statuses");
                callback();
            });
        });
    });
}
exports.fetchNext = fetchNext;
function fetchPrograms(public_api, callback) {
    public_api.listPrograms(function (error, programs) {
        if (error)
            return callback(error);
        async.each(programs, findOrCreateProgram, callback);
    });
}
exports.fetchPrograms = fetchPrograms;
function loop(public_api, interval_ms, callback) {
    setInterval(function () {
        fetchNext(public_api, function (error) {
            if (error)
                return callback(error);
            // if there's an error, we leak the interval, but we're gonna exit anyway,
            // so it's not a big deal
        });
    }, interval_ms);
}
exports.loop = loop;

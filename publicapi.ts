/// <reference path="type_declarations/index.d.ts" />
import request = require('request');

export interface Program {
  ProgramId: string;
  Name: string;
  MapCenter: {
    Latitude: number;
    Longitude: number;
  }
}

export interface Kiosk {
  Id: string;
  Name: string;
  PublicText: string;
  Address: {
    Street: string;
    City: string;
    State: string;
    ZipCode: string;
    Country: string;
    Html: string;
  };
  Location: {
    Latitude: number;
    Longitude: number;
  };
  BikesAvailable: number;
  DocksAvailable: number;
  TotalDocks: number;
  HoursOfOperation: string;
  TimeZone: string;
  Status: string;
  IsEventBased: boolean;
}

export class PublicAPI {
  constructor(protected ApiKey: string) { }

  protected get request() {
    return request.defaults({
      headers: {
        'ApiKey': this.ApiKey,
        'Accept': '*/*',
        'Accept-Language': 'en;q=1',
        'User-Agent': 'B-cycle Now/1.0.2 (iPhone; iOS 8.1; Scale/2.00)',
      },
      gzip: true,
      json: true,
    });
  }

  listPrograms(callback: (error: Error, programs?: Program[]) => void) {
    this.request.get({
      url: 'https://publicapi.bcycle.com/api/1.0/ListPrograms',
    }, (error, response, body) => {
      if (error) return callback(error);
      if (response.statusCode != 200) {
        return callback(new Error(`PublicAPI error: ${response.statusCode}: ${body}`));
      }
      callback(null, body);
    });
  }

  /**
  Fetch all Kiosks for the given program.
  `id` should be B-cycle's internal "ProgramId" identifier.
  */
  listProgramKiosks(id: number, callback: (error: Error, kiosks?: Kiosk[]) => void) {
    this.request.get({
      url: `https://publicapi.bcycle.com/api/1.0/ListProgramKiosks/${id}`,
    }, (error, response, body) => {
      if (error) return callback(error);
      if (response.statusCode != 200) {
        return callback(new Error(`PublicAPI error: ${response.statusCode}: ${body}`));
      }
      callback(null, body);
    });
  }
}

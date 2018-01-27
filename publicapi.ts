import {defaults} from 'request'

export interface Program {
  ProgramId: string
  Name: string
  MapCenter: {
    Latitude: number
    Longitude: number
  }
}

export interface Kiosk {
  Id: string
  Name: string
  PublicText: string
  Address: {
    Street: string
    City: string
    State: string
    ZipCode: string
    Country: string
    Html: string
  }
  Location: {
    Latitude: number
    Longitude: number
  }
  BikesAvailable: number
  DocksAvailable: number
  TotalDocks: number
  HoursOfOperation: string
  TimeZone: string
  Status: string
  IsEventBased: boolean
}

const request = defaults({
  headers: {
    'Accept': '*/*',
    'Accept-Language': 'en;q=1',
    'User-Agent': 'B-cycle Now/1.0.2 (iPhone; iOS 8.1; Scale/2.00)',
  },
  gzip: true,
  json: true,
})

export function listPrograms(ApiKey: string,
                             callback: (error: Error, programs?: Program[]) => void) {
  request.get({
    headers: {ApiKey},
    url: 'https://publicapi.bcycle.com/api/1.0/ListPrograms',
  }, (error, response, body) => {
    if (error) return callback(error)
    if (response.statusCode != 200) {
      return callback(new Error(`B-cycle API error: ${response.statusCode}: ${body}`))
    }
    callback(null, body)
  })
}

/**
Fetch all Kiosks for the given program.
`id` should be B-cycle's internal "ProgramId" identifier.
*/
export function listProgramKiosks(ApiKey: string, id: number,
                                  callback: (error: Error, kiosks?: Kiosk[]) => void) {
  request.get({
    headers: {ApiKey},
    url: `https://publicapi.bcycle.com/api/1.0/ListProgramKiosks/${id}`,
  }, (error, response, body) => {
    if (error) return callback(error)
    if (response.statusCode != 200) {
      return callback(new Error(`B-cycle API error: ${response.statusCode}: ${body}`))
    }
    callback(null, body)
  })
}

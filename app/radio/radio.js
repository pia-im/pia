import fs from 'fs';
import util from 'util';
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
import { JSONApp } from '../../baseapp/JSONApp.js';
import { getConfig } from '../../util/config.js';
import { assert } from '../../util/util.js';

export default class Radio extends JSONApp {
  constructor() {
    super("radio");
  }

  async load(lang) {
    await super.load(lang);
    await this.loadStations();
  }

  async loadStations() {
    let stationType = this.dataTypes.Station; // NamedValues
    let genreType = this.dataTypes.Genre; // NamedValues

    let stations = JSON.parse(await readFileAsync(this.dataDir + "stations.json"));
    for (let station of stations) {
      stationType.addValue(station.name, station);

      // Genres
      for (let genreName of station.tags) {
        let stationList = genreType.valueIDForTerm(genreName);
        if (stationList) {
          stationList.push(station);
        } else {
          stationList = [ station ];
          genreType.addValue(genreName, stationList);
        }
      }
    }
  }

  /**
   * Command
   * @param args {object}
   *    Station {station JSON}
   * @param client {ClientAPI}
   * @returns {URL}  The streaming MP3
   */
  async playStation(args, client) {
    assert(args.Station, "Need station");
    // if (!args.Station) { throw this.error("not-found-station"); }
    return await this._playStation(args.Station, client);
  }

  /**
   * Command
   * @param args {object}
   *    Genre {Array of Station JSON}
   * @param client {ClientAPI}
   * @returns {URL}  The streaming MP3
   */
  async playGenre(args, client) {
    assert(args.Genre, "Need genre");
    // if (!genre) { throw this.error("not-found-genre"); }
    let stations = args.Genre;
    if (!stations.length) {
      throw this.error("not-found-station-in-genre");
    }
    let station = pickRandom(stations);
    let session = client.userSession;
    session.currentStation = station;
    session.stations = stations;

    // Add the chosen station as result
    let stationType = this.dataTypes.Station;
    if (stationType.terms.includes(station.name)) {
      client.addResult(station.name, stationType);
    }

    return await this._playStation(station, client);
  }

  /**
   * Internal helper function
   * Starts playing the station
   * @param station {station from JSON}
   * @param client {ClientAPI}
   */
  async _playStation(station, client) {
    if (station.stream) {
      await client.player.playAudio(station.stream, this, () => this.next({}, client));
      return;
    }
    return await this._playM3U(station.m3u, client);
  }

  /**
   * Play songs
   *
   * Starts the audio player
   *
   * Not currently used, because the data source resolves the M3U for us.
   *
   * @param m3u {URL}
   * @param client {ClientAPI}
   */
  async _playM3U(m3u, client) {
    console.log("Fetching " + m3u);
    let headers = {
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": client.lang + ",en-US",
      //"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      //"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:76.0) Gecko/20100101 Firefox/76.0 Pia/0.1",
    };
    let m3uContents = await r2(m3u, { headers }).text;
    let url = m3uContents.split("\n")[0];
    if (url.toLowerCase().includes("html")) {
      console.error("Got an HTML page while trying to fetch m3u for the radio station at <" + m3u + ">", m3uContents.substr(0, 50));
      throw this.error("station-not-available");
    }
    await client.player.playAudio(url, this, () => {
      // called when the stream ends
      this.next({}, client);
    });
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async stop(args, client) {
    await client.player.stop();
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async next(args, client) {
    let session = client.userSession;
    let stations = session.stations;
    let pos = stations.indexOf(session.currentStation);
    if (!pos) {
      station = pickRandom(stations);
    } else {
      pos++;
      station = stations[pos >= stations.length ? 0 : pos];
    }
    return await this._playStation(station, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async previous(args, client) {
    let session = client.userSession;
    let stations = session.stations;
    let pos = stations.indexOf(session.currentStation);
    if (!pos) {
      station = pickRandom(stations);
    } else {
      pos--;
      station = stations[pos < 0 ? stations.length - 1 : pos];
    }
    return await this._playStation(station, client);
  }

  /**
   * Command
   * @param args {object}
   *    Volume {Number} 0..100
   * @param client {ClientAPI}
   */
  async volume(args, client) {
    let volume = args.Volume;
    assert(typeof(volume) == "number", "Need new volume as number");
    // Range 0..100
    if (volume > 100) {
      throw this.error("volume-too-high");
    }
    if (volume < 0) {
      throw this.error("volume-too-low");
    }

    await client.player.setVolume(volume);
  }

  /**
   * Command
   * @param args {object}
   *    RelativeVolume {Number}  -100..100
   * @param client {ClientAPI}
   */
  async relativeVolume(args, client) {
    let relativeVolume = args.RelativeVolume;
    assert(typeof(relativeVolume) == "number", "Need relative volume");
    if (relativeVolume > 100) {
      throw this.error("relative-volume-too-high");
    }
    if (relativeVolume < -100) {
      throw this.error("relative-volume-too-low");
    }

    await client.player.setRelativeVolume(relativeVolume);
  }
}


/**
  * Returns a random element from the array
  * @param array {Array}
  * @returns {Object} one array element
  */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}
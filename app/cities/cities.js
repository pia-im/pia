import { JSONApp } from '../../baseapp/JSONApp.js';
import { Location } from '../../baseapp/datatype/Location.js';
import { getConfig } from '../../util/config.js';
import { round, assert } from '../../util/util.js';
import langCodes from 'iso-639-1';
import fs from 'fs';
import readline from 'readline';

var gCurrentLocation = {
  lat: 0.0,
  lon: 0.0,
};

/**
 * Primary purpose of this app is to load cities into the LocationDataType
 * for use as location by other apps.
 *
 * @see LocationDataType for more info
 */
export default class Cities extends JSONApp {
  constructor() {
    super("cities");
    /**
     * {LocationDataType}
     */
    this._dataType = null;
    /**
     * {ISO 2-letter code {string} -> Country {JSON}}
     */
    this._countries = new Map();

    gCurrentLocation = getConfig().homeLocation;
    if (!gCurrentLocation.lat) {
      console.log("\nPlease set your city and lat/lon GPS coordinates in config.homeLocation. This is needed for any location lookups.\n");
    }
  }

  async load(lang) {
    await super.load(lang);
    this._dataType = this.dataTypes["Pia.Location"];
    //assert(this._dataType instanceof LocationDataType);

    console.time("Loading cities");
    await this.loadCountries();
    await this.loadCities();
    console.timeEnd("Loading cities");
    /*for (let city of this._dataType.values.sort((a, b) => a.score - b.score)) {
     if (city instanceof City && city.population > 100000) {
       console.log(city.name, city.population, city.distance, city.score);
     }
    }*/
    console.log(`Kept ${ this._dataType.values.length } cities`);
  }

  async loadCountries(lang) {
    await this.readByLine(this.dataDir + "countryInfo.txt", "\t", fields => this.processCountry(fields));
  }

  async loadCities(lang) {
    // Read all 140000 cities and villages of the world
    await this.readByLine(this.dataDir + "cities1000.txt", "\t", fields => this.processCity(fields));
  }

  /**
   * Reads a CSV file line by line, and feeds it line by line to `processFunc()`
   *
   * @param filename {string} relative file path
   * @param fieldSeparator {string} single character or regexp to split the fields of a single line
   * @param processFunc {Function(fields {Array of string})} Called for each line, with an array of the fields
   */
  async readByLine(filename, fieldSeparator, processFunc) {
    const fileStream = fs.createReadStream(filename);
    const readByLine = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity, // takes '\r\n' are 1 linebreak
    });

    for await (let line of readByLine) {
      try {
        processFunc(line.split(fieldSeparator));
      } catch (ex) {
        console.error(ex);
      }
    }
  }

  processCity(fields) {
    let city = new City(fields);
    if (city.score > 1) {
      return;
    }
    this._dataType.addValue(city.name, city);
    /*for (let alternativeName of city.alternativeNames) {
      this._dataType.addValue(alternativeName, city);
    }*/
  }

  processCountry(fields) {
    if (!fields[0] || fields[0][0] == "#") { // empty line or comment
      return;
    }
    let country = new Country(fields);
    this._dataType.addValue(country.name, country);
    this._countries.set(country.isoCode, country);
  }

  where(args, client) {
    let location = args.Location;
    assert(location, "Need the location");
    if (location.continent) {
      let continent = this.dataTypes.Continent.termForValue(location.continent);
      let neighborCountries = location.neighbors.map(isoCode => {
        let country = this._countries.get(isoCode);
        return country ? country.name : isoCode;
      }).join(", ");
      return this.getResponse("where-country", {
        location: location.name,
        continent: continent,
      }) + " \n" + neighborCountries + ".";
    } else {
      let country = this._countries.get(location.countryCode);
      return this.getResponse("where-city", {
        location: location.name,
        country: country ? country.name : "",
      });
    }
  }

  population(args, client) {
    let location = args.Location;
    assert(location, "Need the location");
    let population = round(location.population, 2);
    if (false && location.modDate) { // not really useful
      return this.getResponse("population-at-year", {
        location: location.name,
        population: population,
        year: location.modDate.getFullYear(),
      });
    } else {
      return this.getResponse("population", {
        location: location.name,
        population: population,
      });
    }
  }

  language(args, client) {
    let location = args.Location;
    assert(location, "Need the location");
    let lang = location.lang;
    if (!lang && location.countryCode) {
      let country = this._countries.get(location.countryCode);
      if (country) {
        lang = country.lang;
      }
    }
    let langName = langCodes.getName(lang); // TODO returns English
    // langCodes.getNativeName(lang); // returns thier language, not ours
    return this.getResponse("language", {
      location: location.name,
      language: langName,
    });
  }

  info(args, client) {
    return this.where(args, client) + " \n" +
      this.population(args, client) + " \n" +
      this.language(args, client);
  }
}

class City extends Location {
  /**
   * @param fields {Array of string} in order:
   * 0. geonameid         : integer id of record in geonames database
   * 1. name              : name of geographical point (utf8) varchar(200)
   * 2. asciiname         : name of geographical point in plain ascii characters, varchar(200)
   * 3. alternatenames    : name in other languages, comma separated, varchar(10000)
   * 4. latitude          : latitude in decimal degrees (wgs84)
   * 5. longitude         : longitude in decimal degrees (wgs84)
   * 6. feature class     : see http://www.geonames.org/export/codes.html, char(1)
   * 7. feature code      : see http://www.geonames.org/export/codes.html, varchar(10)
   * 8. country code      : ISO-3166 2-letter country code, 2 characters
   * 9. cc2               : alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
   * 10. admin1 code       : fipscode (soon iso code), see file admin1Codes.txt for display names of this code; varchar(20)
   * 11. admin2 code       : code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
   * 12. admin3 code       : code for third level administrative division, varchar(20)
   * 13. admin4 code       : code for fourth level administrative division, varchar(20)
   * 14. population        : bigint (8 byte int)
   * 15. elevation         : in meters, integer
   * 16. dem               : digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
   * 17. timezone          : the iana timezone id (see file timeZone.txt) varchar(40)
   * 18. modification date : date of last modification in yyyy-MM-dd format
   */
  constructor(fields) {
    super();
    this.geonameid = fields[1];
    this._name = fields[1];
    //this.alternativeNames = fields[3].split(",").filter(n => n);
    this._lat = parseFloat(fields[4]);
    this._lon = parseFloat(fields[5]);
    this.population = parseInt(fields[14]);
    this.countryCode = fields[8];
    this.timezone = fields[17];
    this.modDate = new Date(fields[18]);
  }
  get id() {
    return this.geonameid;
  }
  get name() {
    return this._name;
  }
  get lat() {
    return this._lat;
  }
  get lon() {
    return this._lon;
  }
  get score() {
    // determine whether to add this city,
    // depending on population size and distance from user
    // if distance > roughly 100-200 km, drop cities < 10000 population
    // if distance > roughly 1000 km, drop cities < 100000 population
    // if distance > roughly 5000 km, drop cities < 1000000 population
    // keep all cities world-wide > 1000000 population
    // but this is too coarse, so:
    /*if (distance > 1 &&
      city.population / (distance * distance) < 1000) {
      continue;
    }*/
    // calculate the ratio of population and distance²
    let distance = this.distance;
    return (distance * distance) / (this.population / 1000);
  }
  /**
   * Returns the distance of the city to the current location of the user.
   * In latitudes (but of course also considering longitudes), which means:
   * 2 = roughly 100-200 km
   * 8 = roughly 1000 km
   * 50 = roughly 5000 km
   * @return {float}
   */
  get distance() {
    const kLonMultiplier = 0.5;
    return Math.abs(this._lat - gCurrentLocation.lat) + Math.abs(this._lon - gCurrentLocation.lon) * kLonMultiplier;
  }
}

class Country extends Location {
  /**
   * @param fields {Array of string} in order:
   * 0. ISO code 2 letter
   * 1. ISO code 3 letter
   * 2. ISO code numeric
   * 3. FIPS
   * 4. Name, in English
   * 5. Capital city
   * 6. Size. Area in km² {integer}
   * 7. Population/inhabitants {integer}
   * 8. Continent
   * 9. Internet top level domain, with dot, e.g. ".de"
   * 10. Currency, 3 letter code, e.g. "EUR"
   * 11. Currency name in English, e.g. "Euro"
   * 12. Telephone dial code, without +, e.g. 49
   * 13. Postal Code Format, whereby # is a digit and @ is a letter
   * 14. Postal Code Regex
   * 15. languages, comma-separated list of locales, 2 or 5 chars
   * 16. geoname ID
   * 17. neighbor countries. comma-separated list of 2-letter ISO codes
   * 18. Equivalent FIPS code
   */
  constructor(fields) {
    super();
    this._name = fields[4];
    this.isoCode = fields[0];
    this.population = parseInt(fields[7]);
    this.continent = fields[8];
    this.neighbors = fields[17].split(",").filter(n => n);
    this.phonePrefix = parseInt(fields[12]);
    this.lang = fields[15].substr(0, 2);
  }
  get id() {
    return this._isoCode;
  }
  get name() {
    return this._name;
  }
  get lat() {
    return null;
  }
  get lon() {
    return null;
  }
  get score() {
    return 0.1;
    // a country with 100 million inhabitants should have score 0.01
    // and larger countries a better = lower score.
    // but all countries should have a score less than 0.3
  }
}

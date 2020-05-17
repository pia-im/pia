import mpg321 from 'mpg321';
import { Player } from '../Player.js';
import { getConfig } from '../../util/config.js';
import { assert } from '../../util/util.js';

/**
 * Plays audio or video streams using mpg321
 */
export default class MPG321Player extends MPG123Player {
  constructor() {
    super();
  }

  _createInstance() {
    //.audioDevice(getConfig().audio.outputDevice); e.g. "hw0,0"
    this._mpg = mpg321().quiet().remote();
  }

  /**
   * @param volume {integer} 0..100
   */
  setVolume(volume) {
    assert(typeof(volume) == "number", "volume required");
    volume = Math.round(volume);
    assert(volume >= 0 && volume <= 100);

    this._mpg.gain(volume);
  }
}

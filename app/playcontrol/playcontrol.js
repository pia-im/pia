import { JSONApp } from '../../baseapp/JSONApp.js';

export default class PlayControl extends JSONApp {
  constructor() {
    super("play", "app/playcontrol/");
  }

  async load(lang) {
    await super.load(lang);
  }

  /**
   * The current or last media playing app.
   * Allows to control playback (stop, pause, skip etc.)
   * and volume.
   *
   * The app needs to implement standard intents like
   * - Pia.Stop
   * - Pia.Volume
   * - Pia.RelativeVolume
   * and optionally
   * - Pia.Pause
   * - Pia.Resume
   * - Pia.Next
   * - Pia.Previous
   * The client can then offer a standard user interface
   * (by voice or GUI) that allows to control playback.
   *
   * @returns {AppBase}
   */
  _getApp(client) {
    let contexts = client.context.slice().reverse();
    for (let context of contexts) {
      if (context.app == this) {
        continue;
      }
      let app = context.app;
      let sampleFunction = app.volume;
      if (sampleFunction && typeof(sampleFunction) == "function") {
        assert(typeof(app.stop) == "function");
        assert(typeof(app.volume) == "function");
        assert(typeof(app.relativeVolume) == "function");
        return app;
      }
    }
    throw new Error("No media is playing at the moment");
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async stop(args, client) {
    await this._getApp(client).stop(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async next(args, client) {
    await this._getApp(client).next(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async previous(args, client) {
    await this._getApp(client).previous(args, client);
  }

  /**
   * Command
   * @param args {object}
   *    Volume {Number} 0..100
   * @param client {ClientAPI}
   */
  async volume(args, client) {
    let volume = args.Volume;
    if (typeof(volume) != "number") {
      throw new Error("Need new volume as number");
    }
    // Range 0..100
    if (volume < 0 || volume > 100) {
      throw new Error("Volume number too high or too low");
    }
    // We'll interpret 0..10 as if 10 is the max
    if (volume > 0 && volume <= 10) {
      volume *= 10;
    }
    args.Volume = volume;

    await this._getApp(client).volume(args, client);
  }

  /**
   * Command
   * @param args {object}
   *    RelativeVolume {Number}  -10..10
   * @param client {ClientAPI}
   */
  async relativeVolume(args, client) {
    let relativeVolume = args.RelativeVolume;
    if (typeof(relativeVolume) != "number") {
      throw new Error("Need relative volume");
    }
    // Range -10..10
    if (relativeVolume < -10 || relativeVolume > 10) {
      throw new Error("Relative volume too high or too low");
    }
    // Convert to range -100..100
    relativeVolume *= 10;
    args.RelativeVolume = relativeVolume;

    await this._getApp(client).relativeVolume(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async volumeUp(args, client) {
    args.RelativeVolume = 10; // 10% up
    await this._getApp(client).relativeVolume(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async volumeDown(args, client) {
    args.RelativeVolume = -10; // 10% down
    await this._getApp(client).relativeVolume(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async mute(args, client) {
    args.Volume = 0;
    await this._getApp(client).volume(args, client);
  }

  /**
   * Command
   * @param args {null}
   * @param client {ClientAPI}
   */
  async unmute(args, client) {
    // TODO save old volume during mute and restore it here
    args.Volume = 50;
    await this._getApp(client).volume(args, client);
  }
}

/**
 * Transforms an audio stream with speech into a text string.
 * Uses DeepSpeech.
 */

import DeepSpeech from 'deepspeech';
import { textPostProcess } from './postprocess.js';
import { getConfig } from '../../util/config.js';
import { loadJSONFile } from '../../util/util.js';
import os from 'os';

var model;

export async function load() {
  let config = getConfig().deepSpeech;
  if (config.modelDir) {
    if (!config.modelDir.endsWith("/")) {
      config.modelDir += "/";
    }
    let deepSpeechPackage = loadJSONFile('./node_modules/deepspeech/package.json');
    let version = deepSpeechPackage.version;
    let dir = config.modelDir.replace("%version%", version);
    let basename = `${dir}deepspeech-${version}-models.`;
    config.model = config.model || basename + (os.arch() == "arm" || os.arch() == "arm64" ? "tflite" : "pbmm");
    config.scorer = config.scorer || basename + "scorer";
  }
  console.info('Loading model from file %s and scorer from file %s', config.model, config.scorer);
  const startTime = new Date();
  model = new DeepSpeech.Model(config.model);
  model.enableExternalScorer(config.scorer);
  if (config.beamWidth) { // normally part of the model file
    model.setBeamWidth(config.beamWidth);
  }
  console.info('Loaded model in %ds.', (new Date() - startTime) / 1000);
}

export function unload() {
  DeepSpeech.FreeModel(model);
}

export function audioProperties() {
  return {
    bits: 16,
    channels: 1,
    encoding: 'signed-integer',
    rate: model.sampleRate(),
    type: 'raw',
  };
}

/**
 * Streaming voice recognition.
 *
 * 1. new SpeechRecognizer()
 * 2. Call processAudio() several times, as your audio comes in
 * 3. Call end() and get the text
 * 4. Drop the object
 */
export class SpeechRecognizer {
  /**
   * @param customModel {DeepSpeech Model} (Optional) null = normal language
  constructor(customModel) {
    this.model = customModel || model;
   */
  constructor() {
    this.model = model;
    this.modelStream = this.model.createStream();
  }

  /**
   * Add new voice audio data to an ongoing recognition.
   * @param audioBuffer {Buffer} audio data from the microphone
   *    Audio needs to be in format `audioProperties()`
   *
   * TODO should be async, but DeepSpeech is currently blocking :(
   * Workaround: Wrap in `(async () => {...}();` ?
   */
  processAudio(audioBuffer) {
    this.modelStream.feedAudioContent(audioBuffer.slice(0));
  }

  /**
   * The audio stream finished.
   * @returns {string} The text recognized from the audio
   *
   * TODO should be async, but DeepSpeech is currently blocking :(
   */
  end() {
    let text = this.modelStream.finishStream()
    text = textPostProcess(text);
    return text;
  }
}

/**
 * Converts audio into text
 * Does it all at once, after the audio has finished, and is therefore slow.
 * @param audioBuffer {Buffer}   Entire spoken sentence
 *    Audio needs to be in format `audioProperties()`
 */
export function speechToText(audioBuffer) {
  console.info('Running speech recognition');
  let startTime = new Date();

  // TODO blocking
  let text = model.stt(audioBuffer);

  let prop = audioProperties();
  let audioLength = (audioBuffer.length * 8 / prop.bits) / prop.rate;
  console.info('Inference took %ds for %ds audio file.', (new Date() - startTime) / 1000, audioLength.toPrecision(4));
  console.log('Speech recognition result: ' + text);
  return text;
}


/**
 * Converts audio into text, using a confined vocabulary.
 *
 * @param languageModel {LanguageModel} path to lm.binary file
 *
export function speechToTextWithLanguageModel(audioBuffer, languageModel) {
  model.enableDecoderWithLM(languageModel, config.trie, config.lmAlpha, config.lmBeta);
  return speechToText(audioBuffer);
  // TODO switch back to default language model?
}

/**
 * Allows you to restrict the recognized words,
 * giving better recognition rates on a limited vocabulary.
 *
 * @param listOfSentences {Array of string}  A complete (!) list of
 *    all allowed sentences that are valid when this model is active.
 * @returns {LanguageModel}  LM
 *    Pass this to `speechToTextWithLanguageModel()` and
 *    `DataType.languageModel`.
 *
export function trainSpeechToTextOnVocabulary(listOfSentences) {
}
*/

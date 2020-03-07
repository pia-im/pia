/**
 * Transforms an audio stream with speech into a text string.
 * Uses DeepSpeech.
 */

import Ds from 'deepspeech';
import { commandlineArgs } from './util.js';

var model;

export async function load() {
  let args = commandlineArgs();
  console.info('Loading model from file %s', args['model']);
  const startTime = new Date();
  model = new Ds.Model(args['model'], args['beam_width']);
  if (args['lm'] && args['trie']) {
    console.info('Loading language model from files %s and %s', args['lm'], args['trie']);
    //const startTime = process.hrtime();
    model.enableDecoderWithLM(args['lm'], args['trie'], args['lm_alpha'], args['lm_beta']);
    //console.info('Loaded language model in %ds.', (new Date() - startTime) / 1000);
  }
  console.info('Loaded model in %ds.', (new Date() - startTime) / 1000);
}

export function unload() {
  Ds.FreeModel(model);
}

export function sampleRate() {
  return model.sampleRate();
}


export function speechToText(audioBuffer) {
  console.info('Running speech recognition');
  let startTime = new Date();

  let text = model.stt(audioBuffer);

  let audioLength = (audioBuffer.length / 2) * (1 / model.sampleRate());
  console.info('Inference took %ds for %ds audio file.', (new Date() - startTime) / 1000, audioLength.toPrecision(4));
  console.log('Speech recognition result: ' + text);
  return text;
}

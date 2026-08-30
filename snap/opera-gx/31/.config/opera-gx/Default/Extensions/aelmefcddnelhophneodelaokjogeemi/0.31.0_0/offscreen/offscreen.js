/**
 * Copyright (C) 2025 Opera Norway AS. All rights reserved.
 * This file is an original work developed by Opera Norway AS
 */

const sounds = new Sounds();

chrome.runtime.onMessage.addListener(message => {
  if (message.target !== 'offscreen') {
    return;
  }
  if (message.type === 'PLAY_SOUND') {
    sounds.setVolume(message.volume);
    sounds.play();
  }
});

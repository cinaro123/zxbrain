/**
 * Copyright (C) 2019-2025 Opera Norway AS. All rights reserved.
 * This file is an original work developed by Opera Norway AS
 */

class Sounds {
  constructor() {
    this._audio = null;
  }

  setVolume(volume) {
    if (this._audio !== null) {
      this._audio.volume = volume;
    } else {
      this._volume = volume;
    }
  }

  play() {
    if (this._audio === null) {
      this._audio = new Audio('../assets/notification.mp3');
      this._audio.volume = this._volume;
    }
    this._audio.pause();
    this._audio.currentTime = 0;
    this._audio.play();
  }
}

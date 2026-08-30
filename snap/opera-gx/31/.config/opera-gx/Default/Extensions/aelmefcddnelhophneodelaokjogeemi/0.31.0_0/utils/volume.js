/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

// Volume Prefs key
const SOUNDS_VOLUME = 'gx.sounds_volume_v2';

export class Volume {
  constructor() {
    this.listeners = [];
    this.prefsListener = null;

    if (!chrome.settingsPrivate) {
      return;
    }

    this.prefsListener = changes => {
      const pref = changes.find(pref => pref.key === SOUNDS_VOLUME);

      if (pref) {
        this._onPrefChange(pref.value / 100);
      }
    };
    chrome.settingsPrivate.onPrefsChanged.addListener(this.prefsListener);
  }

  _onPrefChange(volume) {
    this.listeners.forEach(listener => {
      listener(volume);
    });
  }

  async connect(fn) {
    this.listeners.push(fn);
    fn(await this.get());
  }

  disconnect(fn) {
    this.listeners = this.listeners.filter(listener => listener !== fn);
  }

  async get() {
    return new Promise(resolve => {
      if (!chrome.settingsPrivate) {
        resolve(1);
      }
      chrome.settingsPrivate.getPref(
          SOUNDS_VOLUME,
          pref => resolve(pref.value / 100),
      );
    });
  }

  cleanup() {
    if (this.prefsListener && chrome.settingsPrivate) {
      chrome.settingsPrivate.onPrefsChanged.removeListener(this.prefsListener);
    }
    this.listeners = [];
  }
}

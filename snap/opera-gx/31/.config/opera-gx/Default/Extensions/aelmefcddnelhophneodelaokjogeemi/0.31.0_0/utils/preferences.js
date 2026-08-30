/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */
const PREFERENCES_ROOT = 'preferences';

export class Preferences {
  constructor(onReady) {
    this.cache = {};
    this.registeredPrefs = {};
    this._onStorageChanged = (changes, namespace) =>
      this._onStorageEvent(changes, namespace);
    chrome.storage.onChanged.addListener(this._onStorageChanged);
    this._initializePreferences();
    // Load cache asynchronously in the background, don't wait for it
    this._createCache().then(() => {
      if (onReady) {
        onReady();
      }
    });
  }

  _initializePreferences() {
    this._registerEnumPref(
        'avatarHoverEffect', 'small-to-large',
        // details-line is not finished - thus disabled for now
        ['slide-in' /*, 'details-line'*/, 'small-to-large'], x => x);
    this._registerEnumPref(
        'avatarListStyle', 'icons', ['icons', 'details'], x => x);
    this._registerBooleanPref('soundsMuted', false);
    this._registerBooleanPref('showFilter', true);
  }

  addEventListener(name, listener) {
    if (!Object.keys(this.registeredPrefs).includes(name)) {
      throw `Unknown pref ${name}`;
    }
    this.registeredPrefs[name].listeners.push(listener);
  }

  _onPrefChanged(prefName, oldValue, newValue) {
    const pref = this.registeredPrefs[prefName];
    for (let listener of pref.listeners) {
      listener(prefName, oldValue, newValue);
    }
  }

  _registerEnumPref(name, defaultValue, possibleEnumValues, parser) {
    this._registerPref(
        name, defaultValue, x => possibleEnumValues.includes(x), parser);
  }

  _registerBooleanPref(name, defaultValue) {
    this._registerPref(
        name, defaultValue, x => typeof x === 'boolean', x => x === 'true');
  }

  _registerPref(name, defaultValue, validator, parser) {
    this.registeredPrefs[name] = {
      validator: validator,
      parser: parser,
      listeners: [],
      defaultValue: defaultValue,
    };

    Object.defineProperty(this, name, {
      get: () => this._getPref(name, defaultValue),
      set: val => this._setPref(name, val, validator),
    });
  }

  _prefNameFromStorage(storageName) {
    if (!storageName.startsWith(`${PREFERENCES_ROOT}.`)) {
      return null;
    }
    return storageName.slice(PREFERENCES_ROOT.length + 1);
  }

  _storagePath(prefName) {
    return `${PREFERENCES_ROOT}.${prefName}`;
  }

  _getPref(name, defaultValue) {
    const storedVal = this.cache[this._storagePath(name)];
    if (storedVal === null || storedVal === undefined) {
      return defaultValue;
    }
    return storedVal;
  }

  _setPref(name, value, validator) {
    if (!validator(value) && value !== null && value !== undefined) {
      throw 'Invalid Pref Value';
    }
    this._onSetPref(name, value);
  }

  async _createCache() {
    let props = Object.keys(this.registeredPrefs);
    for (let i = 0; i < props.length; i++) {
      props[i] = this._storagePath(props[i]);
    }
    try {
      this.cache = await chrome.storage.local.get(props);
    } catch (error) {
      console.error('Failed to load preferences from storage:', error);
    }
  }

  _onStorageEvent(changes, namespace) {
    for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
      const prefName = this._prefNameFromStorage(key);
      if (prefName == null ||
          !Object.keys(this.registeredPrefs).includes(prefName)) {
        return;
      }

      this.cache[key] = newValue;
      this._onPrefChanged(prefName, oldValue, newValue);
    }
  }

  async _onSetPref(name, value) {
    let path = this._storagePath(name);
    this.cache[path] = value;
    try {
      const result = await chrome.storage.local.get([path]);
      if (result[path] !== value) {
        let set = {[path]: value};
        await chrome.storage.local.set(set);
        this._onPrefChanged(name, result[path], value);
      }
    } catch (error) {
      console.error('Failed to set preference:', error);
    }
  }

  cleanup() {
    if (this._onStorageChanged) {
      chrome.storage.onChanged.removeListener(this._onStorageChanged);
    }
  }
}

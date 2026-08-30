/**
 * Copyright (C) 2019-2025 Opera Norway AS. All rights reserved.
 * This file is an original work developed by Opera Norway AS
 */

import {DUMMY_STREAM_DATA} from './dummy_steamer_data.js';
import {Colors} from './utils/colors.js';
import {Preferences} from './utils/preferences.js';
import {$, showFeedbackPopup} from './utils/utils.js';

const ACTIVITIES = ['login', 'main', 'settings'];

class TwitchApp {
  constructor(colors, locale) {
    this.messageIdCounter = 0;
    this.colors = colors;
    this.colors.registerEvents();
    this.clearNotifications = this.clearNotifications.bind(this);
    locale.setup();
    locale.setupName('filterFollows', 'placeholder');
    this.prefs = new Preferences(() => { this.init(); });
  }

  bindPrefsToElements(elements) {
    for (const element of elements) {
      const attributeValue = element.getAttribute('bind-preference');
      if (attributeValue === null) {
        continue;
      }
      const isNegation = attributeValue.startsWith('!');
      const prefName = isNegation ? attributeValue.slice(1) : attributeValue;
      // Only used for checkboxes
      const maybeNegated = val => (isNegation ? !val : val);
      const isCheckbox = element.type === 'checkbox';
      const setValueForElement = () => {
        if (isCheckbox) {
          element.checked = maybeNegated(this.prefs[prefName]);
        } else {
          if (element.value === undefined) {
            const input = element.querySelector(
                `input[value=${this.prefs[prefName]}]`,
            );
            if (!input) {
              throw `Missing input for value=${this.prefs[prefName]}`;
            }
            input.click();
          } else {
            element.value = this.prefs[prefName];
          }
        }
      };

      setValueForElement();

      this.prefs.addEventListener(prefName, () => {
        setValueForElement();
      });

      element.addEventListener('change', evt => {
        if (isCheckbox) {
          this.prefs[prefName] = maybeNegated(evt.target.checked);
        } else {
          this.prefs[prefName] = evt.target.value;
        }
      });
    }
  }

  bindVisibilityToPref(element, prefName, options) {
    const setVisibility = () => {
      const visible = this.prefs[prefName];
      if (visible) {
        element.removeAttribute('hidden');
      } else {
        element.setAttribute('hidden', true);
        if (options && options.clearOnHide) {
          element.value = '';
        }
      }
    };
    setVisibility();
    this.prefs.addEventListener(prefName, () => setVisibility());
  }

  setupRadioGroup(container) {
    const updateSelectedStyle = (container, selected) => {
      const inputs = container.querySelectorAll('input[type=radio]');
      for (const input of inputs) {
        input.parentElement.classList.toggle('selected', input === selected);
      }
    };
    container.addEventListener(
        'change',
        evt => updateSelectedStyle(container, evt.target),
    );
    updateSelectedStyle(container, container.querySelector('input:checked'));
    // Make clicking whole radio button container select it
    // (as actual radio buttons are hidden).
    for (const element of container.children) {
      element.addEventListener('click', evt => {
        const input = element.querySelector('input[type=radio]');
        if (input !== evt.target) {
          evt.preventDefault();
          input.click();
        }
      });
    }
  }

  initOptions() {
    for (const visualization of document.querySelectorAll(
             'stream-list.hover-effect-visualization',
             )) {
      visualization.setStreamList(DUMMY_STREAM_DATA.slice(0, 1));
      visualization.addEventListener('click', evt => {
        evt.preventDefault();
        visualization.nextElementSibling.click();
      });
    }

    this.bindPrefsToElements(document.querySelectorAll('[bind-preference]'));

    this.setupRadioGroup(document.querySelector('#avatar-list-style'));
    this.setupRadioGroup(document.querySelector('#avatar-hover-effect'));

    document.querySelector('#options-logout').addEventListener('click', () => {
      this.logout();
    });
  }

  init() {
    this.initOptions();

    document
      .querySelector('.top-bar .top-button.settings')
      .addEventListener('click', () => {
        this.setActivity('settings');
      });

    document
      .querySelectorAll('.top-bar .top-button.close')
      .forEach(btn => btn.addEventListener('click', () => {
        this.setActivity('main');
      }));

    document.body.addEventListener('click', () => {
      let streamsDetails = document.querySelector('#stream-details');
      if (streamsDetails) {
        streamsDetails.parentNode.removeChild(streamsDetails);
      }
    });

    // Clears visible notifications on init
    this.clearNotifications();

    // Any user action should dim notifications
    addEventListener('focus', this.clearNotifications);
    addEventListener('mouseenter', this.clearNotifications);
    opr.sidebarAction.onFocus.addListener(this.clearNotifications);

    // When app is still loaded, check for visibiliy changes
    document.addEventListener(
        'visibilitychange',
        this.clearNotifications,
        true,
    );

    $('.beta').addEventListener('click', showFeedbackPopup);

    $('.filter-input').addEventListener('input', evt => {
      this.setChannelsFilter(evt.srcElement.value);
    });

    this.updateChannels().then(() => {
      this.setActivity('main');
    }).catch(() => {
      /* do nothing, login screen pushed by updateChannel */
    });
    this.prefs.addEventListener(
        'avatarHoverEffect',
        () => this.updateChannels(),
    );
    this.prefs.addEventListener('avatarListStyle', () => this.updateChannels());

    this.bindVisibilityToPref(document.querySelector('#filter'), 'showFilter');
    this.prefs.addEventListener('showFilter', (_name, _old, newValue) => {
      if (!newValue) {
        document.querySelector('#filter > input').value = '';
        // Just setting the value doesn't trigger the input event so we
        // need to set the filter manually.
        this.setChannelsFilter('');
      }
    });
    this.prepareLoginPage();
  }

  prepareLoginPage() {
    const button = document.querySelectorAll('.top-panel-login .button');
    button.forEach(btn => btn.addEventListener('click', async evt => {
      evt.preventDefault();
      evt.stopPropagation();
      chrome.runtime.sendMessage({ type: 'login' }).then(response => {
        if (response.success) {
          this.updateChannels().then(() => {
            this.setActivity('main');
            this.startPeriodicalCheck();
          });
        }
      });
    }));
  }

  clearNotifications() {
    if (document.hidden === true) {
      return;
    }
    this.colors.setBadgeInactive();
  }

  async logout() {
    chrome.runtime.sendMessage({'type': 'logout'}).then(() => {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.setActivity('login');
    });
  }

  setActivity(newActivity) {
    this.currentActivity = newActivity;
    const classList = document.body.classList;
    for (const activity of ACTIVITIES) {
      classList.toggle(`activity_${activity}`, newActivity === activity);
    }
  }

  async startPeriodicalCheck() {

    if (!this.interval) {
      this.interval = setInterval(() => {
        chrome.runtime.sendMessage({type: 'updateStreams'}).then(response => {
          if (response.updateNeeded) {
            this.updateChannels();
          }
        });
      }, 60000);
    }
  }

  async showAuthPrompt() {
    this.setActivity('login');
  }

  async updateChannels() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({type: 'getStreamsInfo'}).then(response => {
        if (response.needsAuthentication) {
          this.showAuthPrompt();
          reject();
        }
        chrome.runtime.sendMessage({type: 'getUserInfo'}).then(user => {
          this.currentChannels = response.channels;
          const streamsElement = document.querySelector('#streams');
          streamsElement.setAttribute('hover-mode',
                                      this.prefs.avatarHoverEffect);
          streamsElement.setAttribute('display-mode',
                                      this.prefs.avatarListStyle);
          streamsElement.setStreamList(response.channels);

          this.renderUser(user);
          this.startPeriodicalCheck();
          resolve();
        });
      });
    });
  }

  setChannelsFilter(filter) {
    this.channelsFilter = filter;
    const streamsElement = document.querySelector('#streams');
    streamsElement.setAttribute('filter', filter);
  }

  channelFitsFilter(channel) {
    return (
      !this.channelsFilter ||
      channel.name.toLowerCase().indexOf(this.channelsFilter.toLowerCase()) >= 0
    );
  }

  renderUser(user) {
    const oldAvatar = document.querySelector('.user .avatar img');

    // removing old event listener
    const avatar = oldAvatar.cloneNode(true);

    oldAvatar.parentNode.replaceChild(avatar, oldAvatar);

    avatar.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({url: `https://www.twitch.tv/${user.login}`});
    });

    avatar.src = user.profile_image_url;
    document.querySelector('.user .name').textContent = user.display_name;
    document.querySelector('.user .followers span.number').textContent =
      user.followers;
  }
}

class Locale {
  setupName(name, propertyName = 'textContent') {
    const placeholder = $(`.locale-${name}`);

    if (!placeholder) {
      console.error(`Missing placeholder for "${name}"`);
      return;
    }

    $(`.locale-${name}`)[propertyName] = chrome.i18n.getMessage(name);
  }

  setup() {
    for (const element of document.querySelectorAll('[data-i18n]')) {
      this.setupElement(element, element.getAttribute('data-i18n'));
    }
  }

  setupElement(element, messageId) {
    element.textContent = chrome.i18n.getMessage(messageId);
  }
}

const locale = new Locale();

window.colors = new Colors();
window.twitch = new TwitchApp(window.colors, locale);

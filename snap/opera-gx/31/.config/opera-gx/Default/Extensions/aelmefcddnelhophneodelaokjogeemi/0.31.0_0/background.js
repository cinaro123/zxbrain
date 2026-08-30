/**
 * Copyright (C) 2019-2025 Opera Norway AS. All rights reserved.
 * This file is an original work developed by Opera Norway AS
 */

import {Colors} from './utils/colors.js';
import {Preferences} from './utils/preferences.js';
import {StatsReporter} from './utils/stats.js';
import {TwitchAPI} from '/utils/twitch_api.js';
import {Volume} from './utils/volume.js';

const CLIENT_ID = 'ju0ntw6bpd1i0cx1ama5buw1q377qy';

const REDIR_URL_STR = `https://${chrome.runtime.id}.chromiumapp.org/`;
const REDIR_URL = new URL(REDIR_URL_STR);

// maybe id_token not needed?
const RESPONSE_TYPE = 'token+id_token';

const SCOPE = 'openid+user:read:follows';

const AUTH_URL =
  `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIR_URL_STR}&response_type=${RESPONSE_TYPE}&` +
  `scope=${SCOPE}`;

const REDIR_TOKEN_REGEXP = /access_token=(\w+)/;
const STATE_REGEXP = /state=(\w+)/;

// TODO decide on poll interval
const REFRESH_INTERVAL_MINUTES = 5;

const CONTEXT_MENU_ID_LOGOUT = 'logout';
const CONTEXT_MENU_ID_MUTE = 'mute';
const CONTEXT_MENU_ID_UNMUTE = 'unmute';

const TILE_PLACEHOLDER_URL = './assets/no-avatar.png';

const USE_IDENTITY_API = true;

class TwitchApp {
  constructor() {
    this.accessToken = undefined;
    this.color = new Colors({isBackground: true});
    this.color.registerEvents();
    this.stats = new StatsReporter(['gx', 'twitch']);
    this.setupConnections();
    this.prefs = new Preferences();
    this.streamsUpdated = false;

    this.readyPromise = (async () => {
      const result = await chrome.storage.local.get(['accessToken', 'follows']);
      this.volume = new Volume();
      this.onVolumeChange = this.onVolumeChange.bind(this);
      this.volume.connect(this.onVolumeChange);

      this.accessToken = result.accessToken;
      this.follows = result.follows ? result.follows : [];
      this.twitchAPI = new TwitchAPI(this.accessToken, CLIENT_ID);
      this.initContextMenu();

      if (this.needsAuthentication()) {
        this.waitForAuthentication();
      } else {
        this.init();
      }
    })();
  }

  onVolumeChange(volume) {
    this.volumeValue = volume;
  }

  onContextMenuCommand(info) {
    switch (info.menuItemId) {
      case CONTEXT_MENU_ID_LOGOUT:
        this.logout();
        break;
      case CONTEXT_MENU_ID_MUTE:
        this.prefs.soundsMuted = true;
        break;
      case CONTEXT_MENU_ID_UNMUTE:
        this.prefs.soundsMuted = false;
        break;
      default:
        break;
    }
  }

  get followsLocal() {
    return this.follows;
  }

  set followsLocal(value) {
    this.follows = value;
    chrome.storage.local.set({follows: this.follows}, () => {
      this.updateBadge(value);
    });
  }

  initContextMenu() {
    chrome.contextMenus.removeAll();

    const logoutItem = {
      id: CONTEXT_MENU_ID_LOGOUT,
      title: chrome.i18n.getMessage('contextMenuLogout'),
      visible: true,
      contexts: ['sidebar_action', 'browser_action'],
      enabled: !this.needsAuthentication(),
    };
    chrome.contextMenus.create(logoutItem, evt => {});

    const muteItem = {
      id: CONTEXT_MENU_ID_MUTE,
      title: chrome.i18n.getMessage('mute'),
      visible: !this.prefs.soundsMuted,
      contexts: ['sidebar_action', 'browser_action'],
    };
    chrome.contextMenus.create(muteItem, evt => {});

    const unmuteItem = {
      id: CONTEXT_MENU_ID_UNMUTE,
      title: chrome.i18n.getMessage('unmute'),
      visible: this.prefs.soundsMuted,
      contexts: ['sidebar_action', 'browser_action'],
    };
    chrome.contextMenus.create(unmuteItem, evt => {});

    // Remove old listener if it exists
    if (this.contextMenuListener) {
      chrome.contextMenus.onClicked.removeListener(this.contextMenuListener);
    }

    // Create and store the new listener
    this.contextMenuListener = this.onContextMenuCommand.bind(this);
    chrome.contextMenus.onClicked.addListener(this.contextMenuListener);

    this.prefs.addEventListener('soundsMuted', () => this.updateContextMenu());
  }

  setBadge(text) {
    opr.sidebarAction.setBadgeText({text});
  }

  clearBadge() {
    opr.sidebarAction.setBadgeText({text: ''});
  }

  updateContextMenu() {
    chrome.contextMenus.update(
      CONTEXT_MENU_ID_LOGOUT,
      {enabled: !this.needsAuthentication()},
      evt => {},
    );

    chrome.contextMenus.update(
      CONTEXT_MENU_ID_MUTE,
      {visible: !this.prefs.soundsMuted},
      evt => {},
    );

    chrome.contextMenus.update(
      CONTEXT_MENU_ID_UNMUTE,
      {visible: this.prefs.soundsMuted},
      evt => {},
    );
  }

  async twitchRequest(func, params = {}) {
    if (this.needsAuthentication() && params.needsAuth !== false) {
      return this._getNeedsAuthData();
    }

    try {
      return await func();
    } catch (err) {
      if (err.status === 401) {
        await this.logout();
        return this._getNeedsAuthData();
      }

      return {error: 'unexpected_error'};
    }
  }

  setupConnections() {
    // this is done externally now
    this.ports = [];
  }

  async setupUpdates() {
    // First update should always update the badge.
    let follows;

    try {
      follows = await this.updateStreamsInfo();
    } catch (e) {
      console.error(e);
    }

    if (!follows) {
      follows = [];
    }

    this.updateBadge(follows);

    chrome.alarms.create('recurringAlarm',
                         {periodInMinutes: REFRESH_INTERVAL_MINUTES});
  }

  updateBadge(follows) {
    let liveCount = 0;

    for (let follow of follows) {
      if (follow.isLive) {
        ++liveCount;
      }
    }

    if (
      this.previousFollowCount !== undefined &&
      liveCount !== this.previousFollowCount
    ) {
      const lightsExtensionId = 'hlgnlpcakcbhfheemdcodfddnojhimjn';
      chrome.runtime.sendMessage(
        lightsExtensionId,
        {
          command: 'trigger_custom_event',
          event_name: 'twitch_notification',
        },
        () => {
          if (chrome.runtime.lastError) {
            // Just ignore if there is no lights extension
          }
        },
      );
    }

    this.previousFollowCount = liveCount;

    // When liveCount = 0, don't show badge nor play sound
    if (liveCount === 0) {
      this.color.setBadgeInactive();
    } else {
      this.color.setBadgeActive();
    }

    this.setBadge(this.capLiveCount(liveCount));
  }

  init() {
    this.registerListeners();
    this.twitchAPI = new TwitchAPI(this.accessToken, CLIENT_ID);
    this.updateContextMenu();
    this.setupUpdates();
    this.color.setBadgeInactive();
  }

  getStateString() {
    if (!this.authStateString) {
      const STATE_LENTH = 16;
      let array = new Uint8Array(STATE_LENTH);
      crypto.getRandomValues(array);
      // hex encoded
      this.authStateString = Array.prototype.map
        .call(array, x => `00${x.toString(16)}`.slice(-2))
        .join('');
    }

    return this.authStateString;
  }

  getAuthUrl() {
    return `${AUTH_URL}&state=${this.getStateString()}`;
  }

  needsAuthentication() {
    return !this.accessToken;
  }

  parseUrl(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }

  isRedirURL(parsedUrl) {
    return (
      parsedUrl &&
      parsedUrl.origin === REDIR_URL.origin &&
      parsedUrl.path === REDIR_URL.path
    );
  }

  // Returns the token if correct, null otherwise
  getTokenFromRedirectUrl(url) {
    let parsedUrl = this.parseUrl(url);

    if (!this.isRedirURL(parsedUrl)) {
      return null;
    }

    let stateMatch = parsedUrl.hash.match(STATE_REGEXP);

    if (stateMatch.length !== 2 || stateMatch[1] !== this.getStateString()) {
      return null;
    }

    let tokenMatch = parsedUrl.hash.match(REDIR_TOKEN_REGEXP);

    if (tokenMatch.length === 2) {
      return tokenMatch[1];
    }

    return null;
  }

  loginInIdentityWindow(url) {
    return new Promise((resolve, reject) => {
      const authInfo = {
        url: this.getAuthUrl(),
        interactive: true,
      };
      chrome.identity.launchWebAuthFlow(authInfo, resolve);
    });
  }

  loginInTab(url) {
    let loginTabId = null;
    let promise = new Promise((resolve) => {
      const cleanup = () => {
        chrome.tabs.onRemoved.removeListener(onRemove);
        chrome.tabs.onUpdated.removeListener(onUpdate);
      };

      const onUpdate = (id, tabChange) => {
        if (id !== loginTabId || !tabChange.url) {
          return;
        }

        const parsedURL = new URL(tabChange.url);
        if (parsedURL.hostname === (new URL(REDIR_URL_STR)).hostname) {
          cleanup();
          chrome.tabs.remove(loginTabId);
          resolve(tabChange.url);
          return;
        }
        if (!parsedURL.hostname.endsWith('twitch.tv')) {
          cleanup();
          resolve('');
          return;
        }
      };

      const onRemove = id => {
        if (id === loginTabId) {
          cleanup();
          resolve('');
        }
      };
    });
    chrome.tabs.create({url: url}, tab => {
      loginTabId = tab.id;
      chrome.tabs.onUpdated.addListener(onUpdate);
      chrome.tabs.onRemoved.addListener(onRemove);
    });
    return promise;
  }

  makeLoginPromise(url) {
    if (USE_IDENTITY_API) {
      return this.loginInIdentityWindow(url);
    }
    return this.loginInTab(url);
  }

  login() {
    if (this._loginPromise !== undefined) {
      return this._loginPromise;
    }

    this._loginPromise = new Promise(resolve => {
      this.makeLoginPromise(this.getAuthUrl()).then(url => {
        const token = this.getTokenFromRedirectUrl(url);

        if (token === null) {
          resolve(false);
        } else {
          chrome.storage.local.set({accessToken: token});
          this.accessToken = token;
          this.init();
          this.stats.recordBoolean('loggedIn', true);
          resolve(true);
        }

        this._loginPromise = undefined;
      });
    });

    return this._loginPromise;
  }

  waitForAuthentication() {
    this.recordLoggedInState();
    this.cleanupListeners();
  }

  cleanupListeners() {
    if (this.volume) {
      this.volume.cleanup();
    }
    if (this.color) {
      this.color.cleanup();
    }
    if (this.prefs) {
      this.prefs.cleanup();
    }
    if (this.contextMenuListener) {
      chrome.contextMenus.onClicked.removeListener(this.contextMenuListener);
      this.contextMenuListener = null;
    }
  }

  registerListeners() {
    this.color.registerEvents();
    this.prefs = new Preferences();
    this.volume = new Volume();
    this.onVolumeChange = this.onVolumeChange.bind(this);
    this.volume.connect(this.onVolumeChange);
    this.initContextMenu();
  }

  async _onMessage(msg) {
    switch (msg.type) {
      case 'getStreamsInfo':
        return await this.twitchRequest(this.getStreamsInfo.bind(this));

      case 'getUserInfo':
        return await this.twitchRequest(this.getUserInfo.bind(this));

      case 'getTopStreamers':
        return await this.twitchRequest(this.getTopStreams.bind(this), {
          needsAuth: false,
        });

      case 'updateStreams': {
        await this.updateStreamsInfo();
        let data = {updateNeeded: this.streamsUpdated};
        this.streamsUpdated = false;
        return data;
      }

      case 'login':
        return {success: await this.login()};

      case 'logout': {
        await this.logout();
        this.stats.recordBoolean('loggedIn', false);
        return {isReply: true, id: msg.id, data: {}};
      }
    }
  }

  async logout() {
    await this.twitchAPI.logout();
    chrome.storage.local.remove('accessToken');
    this.accessToken = undefined;
    this.follows = [];
    chrome.storage.local.remove('follows');
    this.clearBadge();
    this.streamsUpdated = true;
    chrome.alarms.clear('recurringAlarm');
    this.cleanupListeners();
  }

  capLiveCount(liveCount) {
    if (liveCount > 99) {
      return `${liveCount}+`;
    } else if (liveCount === 0) {
      return '';
    }

    return String(liveCount);
  }

  recordLoggedInState() {
    this.stats.recordBoolean('loggedIn', !this.needsAuthentication());
    const loggedIn = this.needsAuthentication() ? 'false' : 'true';
    opr.statsPrivate.recordSessionAggregation(
        'sidebar_twitch.logged_in', loggedIn,
        opr.statsPrivate.Priority.NORMAL,
        opr.statsPrivate.AggregationMode.RESET);
  }

  didFollowListChange(newFollows, oldFollows) {
    const filteredFields = follow => { return {
      id: follow.id,
      name:follow.name,
      iconUrl: follow.iconUrl,
      isLive: follow.isLive,
      gameTitle: follow.gameTitle,
      gameImageUrl: follow.gameImageUrl,
    }};
    return JSON.stringify(newFollows.map(filteredFields)) !==
        JSON.stringify(oldFollows.map(filteredFields));
  }

  updateStreamsInfo() {
    this.recordLoggedInState();
    return this.twitchRequest(async () => {
      let api = this.twitchAPI;

      const userInfo = await api.getUserInfo();
      const followedChannels = await api.getChannelsFollowed(
        userInfo.data[0].id,
      );

      const followedIds = (followedChannels.data || []).map(
          folllow => folllow.broadcaster_id);
      const users = await api.getUsersInfo(followedIds);
      const streams = await api.getStreamsForChannnels(followedIds, false);
      const uniqueGameIds = [
        ...new Set(
          (streams.data || [])
            .map(streamData => streamData.game_id)
            .filter(x => x !== undefined && x !== ''),
        ),
      ];
      const games = await api.getGamesInfo(uniqueGameIds);

      const follows = [];

      for (const follow of (followedChannels.data || [])) {
        // Empty user means the channel is deleted/suspended
        // so this is not any user data set for it is best effort, but not
        // fully reliable.
        const user = (users.data || []).find(
            userData => userData.id === follow.broadcaster_id);
        // Empty stream means user isn't streaming now
        const stream = (streams.data || []).find(
          streamData => streamData.user_id === follow.broadcaster_id,
        );
        const isLive = !!stream;
        const game =
          stream && stream.game_id
            ? (games.data || []).find(gameData => gameData.id === stream.game_id)
            : null;

        const followInfo = {
          id: follow.broadcaster_id,
          name: follow.broadcaster_name,
          iconUrl: user ? user.profile_image_url : TILE_PLACEHOLDER_URL,
          followed_at: follow.followed_at,
          login: follow.broadcaster_login,
          isLive: isLive,
          title: stream ? stream.title : '',
          viewerCount: stream ? stream.viewer_count : 0,
          gameTitle: game ? game.name : '',
          gameImageUrl: game ? game.box_art_url : '',
        };
        follows.push(followInfo);
      }

      const sortedFollows = follows
        .filter(x => !!x)
        .sort((a, b) => (a.followed_at >= b.followed_at ? 1 : -1))
        .sort((a, b) =>
          a.isLive === b.isLive ? 0 : a.isLive > b.isLive ? -1 : 1,
        );

      const listChanged =
          this.didFollowListChange(sortedFollows, this.followsLocal);

      this.followsLocal = sortedFollows;

      if (sortedFollows.length > 0 && listChanged) {
        this.streamsUpdated = true;
        this.playSound();
      }

      return sortedFollows;
    });
  }

  async getUserFollowers(userId) {
    try {
      const followersResults = await this.twitchAPI.getChannelsFollowers(
        userId,
        false,
      );
      return followersResults.total;
    } catch (error) {
      console.error(error);
      return 0;
    }
  }

  async getUserInfo() {
    const userResults = await this.twitchAPI.getUserInfo();
    const user = userResults.data[0];
    user.followers = await this.getUserFollowers(user.id);

    return user;
  }

  toStreamsInfo(follows) {
    return {
      channels: follows,
    };
  }

  _getNeedsAuthData() {
    return {
      needsAuthentication: true,
    };
  }

  async getStreamsInfo() {
    let follows = this.followsLocal;

    if (Object.keys(follows).length === 0) {
      await this.updateStreamsInfo();
      follows = this.followsLocal;
    }

    return this.toStreamsInfo(follows);
  }

  async playSound() {
    if (!this.prefs.soundsMuted) {
      await createOffscreen();
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'PLAY_SOUND',
        volume: this.volumeValue,
      });
    }
  }
}

let creating;

const twitch = new TwitchApp();

// Clean up when service worker is about to be terminated
chrome.runtime.onSuspend.addListener(() => {
  if (twitch && twitch.volume) {
    twitch.volume.cleanup();
  }
  if (twitch && twitch.color) {
    twitch.color.cleanup();
  }
  if (twitch && twitch.prefs) {
    twitch.prefs.cleanup();
  }
  if (twitch && twitch.contextMenuListener) {
    chrome.contextMenus.onClicked.removeListener(twitch.contextMenuListener);
  }
});

chrome.alarms.onAlarm.addListener(() => {
  if (twitch) {
    twitch.updateStreamsInfo();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  twitch.readyPromise.then(() => {
    twitch._onMessage(message).then(response => {
      sendResponse(response);
    });
  });
  return true;
});

async function createOffscreen() {
  if (creating) {
    await creating;
    return;
  }
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  let path = './offscreen/offscreen.html';
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: path,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing audio notification',
  });
  await creating;
  creating = null;
}

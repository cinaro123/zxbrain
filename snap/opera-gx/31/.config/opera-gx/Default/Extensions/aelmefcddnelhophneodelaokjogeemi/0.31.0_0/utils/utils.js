export const $ = (...args) => document.querySelector(...args);

export const showFeedbackPopup = evt => {
  const anchor = evt.target.getClientRects()[0];

  return opr.feedbackPopupPrivate.showPopupWithDesc(
    {
      topic: 'twitch',
      arrow: opr.feedbackPopupPrivate.Arrow.TOP_RIGHT,
      frameSize: {
        height: parseInt(window.visualViewport.height),
        width: parseInt(window.visualViewport.width),
      },
      anchorBounds: {
        x: parseInt(anchor.x),
        y: parseInt(anchor.y),
        width: parseInt(anchor.width),
        height: parseInt(anchor.height),
      },
      anchorId: opr.feedbackPopupPrivate.AnchorId.SIDEBAR,
      hideLearnMore: true,
    },
    () => { });
};

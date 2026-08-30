import {$, showFeedbackPopup} from '../utils/utils.js';

const accentColorName = () =>
  new Promise(resolve => {
    opr.palette.getPalette(palette => {
      resolve(
        palette.includes('gx_accent_dark') ? 'gx_accent_dark' : 'gx_accent_l_100',
      );
    });
  });

const resolveContrastColor = ({r, g, b}) => {
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 170 ? '#FFF' : '#000';
};

const paletteListener = async () => {
  const accentColor = await accentColorName();
  opr.palette.getColor(accentColor, color => {
    document.documentElement.style.setProperty(
      '--opera-primary-button-font-color',
      resolveContrastColor(color),
    );
  });
};

opr.palette.onPaletteChanged.addListener(paletteListener);
paletteListener();

$('.feedback-button').addEventListener('click', showFeedbackPopup);

if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('underwave/twitch_underwave_css_worklet.js');
}
